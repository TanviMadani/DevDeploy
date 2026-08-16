import dotenv from "dotenv";
dotenv.config();

import path from "path";
import fs from "fs";
import { Worker, Job } from "bullmq";
import { createRedisConnection } from "../config/redis";
import { prisma } from "../config/prisma";
import { DeploymentStatus } from "@prisma/client";
import { DeploymentJobData } from "../services/deployment.queue";
import { gitService, sanitizeLog } from "../services/git.service";
import { buildService } from "../services/build.service";
import { runtimeService } from "../services/runtime.service";
import { portService } from "../services/port.service";

/**
 * Resolves and securely validates the deployment working directory based on the project rootDirectory.
 * Prevents path traversal outside the cloned workspace root.
 */
export function resolveDeploymentDirectory(repoRoot: string, rootDirectory?: string | null): string {
    if (!rootDirectory || rootDirectory.trim().length === 0) {
        return repoRoot;
    }

    const trimmed = rootDirectory.trim();
    // Resolve target path relative to repoRoot
    const targetPath = path.resolve(repoRoot, trimmed);
    const relative = path.relative(repoRoot, targetPath);

    // Path traversal check: must not escape repoRoot (relative path starts with '..' or is absolute path outside)
    if (relative.startsWith("..") || path.isAbsolute(relative)) {
        throw new Error(`Invalid rootDirectory '${trimmed}': directory traversal outside repository workspace is not allowed.`);
    }

    // Verify existence
    if (!fs.existsSync(targetPath)) {
        throw new Error(`Configured rootDirectory '${trimmed}' does not exist in the repository.`);
    }

    const stat = fs.statSync(targetPath);
    if (!stat.isDirectory()) {
        throw new Error(`Configured rootDirectory '${trimmed}' is not a directory.`);
    }

    return targetPath;
}

/**
 * Persists a log entry for a specific deployment in the database.
 */
async function addDeploymentLog(deploymentId: number, message: string): Promise<void> {
    try {
        await prisma.deploymentLog.create({
            data: {
                deploymentId,
                message: sanitizeLog(message),
            },
        });
    } catch (err: any) {
        console.error(`[Worker] Failed to persist log for deployment ${deploymentId}:`, err.message);
    }
}

/**
 * BullMQ Worker processing deployment jobs asynchronously.
 */
export const deploymentWorker = new Worker<DeploymentJobData>(
    "deployment",
    async (job: Job<DeploymentJobData>) => {
        const { deploymentId } = job.data;

        if (!deploymentId || typeof deploymentId !== "number") {
            console.warn(`[Worker] Job ${job.id} skipped: invalid or missing deploymentId`);
            return { skipped: true, reason: "invalid or missing deploymentId" };
        }

        console.log(`[Worker] Starting deployment job for deployment ID: ${deploymentId}`);
        let repoRoot: string | null = null;
        let allocatedPort: number | null = null;
        let isRunning = false;

        try {
            // Load deployment and related project
            const deployment = await prisma.deployment.findUnique({
                where: { id: deploymentId },
                include: { project: true },
            });

            if (!deployment) {
                console.warn(`[Worker] Deployment with ID ${deploymentId} not found in database (job skipped)`);
                return { skipped: true, reason: `Deployment with ID ${deploymentId} not found in database` };
            }

            // Log: deployment started
            await addDeploymentLog(deploymentId, `Deployment started for project '${deployment.project.name}'`);

            // Update status to BUILDING
            await prisma.deployment.update({
                where: { id: deploymentId },
                data: { status: DeploymentStatus.BUILDING },
            });

            // Log: status changed to BUILDING
            await addDeploymentLog(deploymentId, "Deployment status changed to BUILDING");
            console.log(`[Worker] Deployment ${deploymentId} ('${deployment.project.name}') status updated to BUILDING`);

            // Stage 1: Perform GitHub repository checkout
            const checkoutResult = await gitService.checkoutRepository({
                deploymentId,
                repositoryUrl: deployment.project.repositoryUrl,
                commitHash: deployment.commitHash,
                branch: deployment.branch,
                onLog: async (message: string) => {
                    await addDeploymentLog(deploymentId, message);
                },
            });

            repoRoot = checkoutResult.workDir;

            // Resolve effective working directory from project rootDirectory setting
            const effectiveWorkDir = resolveDeploymentDirectory(
                repoRoot,
                deployment.project.rootDirectory
            );

            if (deployment.project.rootDirectory && deployment.project.rootDirectory.trim().length > 0) {
                await addDeploymentLog(
                    deploymentId,
                    `Using configured rootDirectory: '${deployment.project.rootDirectory.trim()}'`
                );
            }

            // Stage 2: Perform application build (inspect, install dependencies, run build step)
            await buildService.buildProject({
                deploymentId,
                workDir: effectiveWorkDir,
                buildCommand: deployment.project.buildCommand,
                onLog: async (message: string) => {
                    await addDeploymentLog(deploymentId, message);
                },
            });

            // Update status to RUNNING
            await prisma.deployment.update({
                where: { id: deploymentId },
                data: { status: DeploymentStatus.RUNNING },
            });
            await addDeploymentLog(deploymentId, "Deployment status changed to RUNNING");

            // Stage 3: Allocate dynamic TCP port
            allocatedPort = await portService.allocatePort();
            await addDeploymentLog(deploymentId, `Allocated runtime port ${allocatedPort} for deployment.`);

            // Stage 4: Start application runtime and perform health checks
            await runtimeService.startApplication({
                deploymentId,
                projectId: deployment.projectId,
                workDir: effectiveWorkDir,
                repoRoot,
                port: allocatedPort,
                startCommand: deployment.project.startCommand,
                onLog: async (message: string) => {
                    await addDeploymentLog(deploymentId, message);
                },
            });

            isRunning = true;

            // Compute deployment URL
            const baseUrl = process.env.DEPLOYMENT_BASE_URL || "http://localhost";
            const deploymentUrl = `${baseUrl}:${allocatedPort}`;

            // Update status to SUCCESS with allocated port and deploymentUrl
            const completedDeployment = await prisma.deployment.update({
                where: { id: deploymentId },
                data: {
                    status: DeploymentStatus.SUCCESS,
                    runtimePort: allocatedPort,
                    deploymentUrl,
                },
            });

            // Log URL assignment and completion
            await addDeploymentLog(deploymentId, `Deployment URL assigned: ${deploymentUrl}`);
            await addDeploymentLog(deploymentId, "Deployment completed successfully");
            console.log(`[Worker] Deployment ${deploymentId} finished successfully with URL: ${deploymentUrl}`);

            // Zero-downtime transition: stop previous deployments for this project
            await runtimeService.stopPreviousProjectDeployments(deployment.projectId, deploymentId);

            return completedDeployment;
        } catch (error: any) {
            const rawMessage = error.message || "Unknown error occurred";
            const sanitizedError = sanitizeLog(rawMessage);
            console.error(`[Worker] Error processing deployment ${deploymentId}:`, sanitizedError);

            // Release allocated port if process was not successfully running
            if (allocatedPort && !isRunning) {
                portService.releasePort(allocatedPort);
            }

            // Log: deployment failed with error message
            await addDeploymentLog(deploymentId, `Deployment failed: ${sanitizedError}`);

            try {
                await prisma.deployment.update({
                    where: { id: deploymentId },
                    data: { status: DeploymentStatus.FAILED },
                });
                console.log(`[Worker] Deployment ${deploymentId} marked as FAILED`);
            } catch (dbError: any) {
                console.error(`[Worker] Failed to update deployment ${deploymentId} to FAILED:`, dbError.message || "Unknown error");
            }

            throw new Error(sanitizedError);
        } finally {
            // Clean up temporary workspace directory ONLY if the process is not actively running
            if (repoRoot && !isRunning) {
                await gitService.cleanupWorkingDirectory(repoRoot);
            }
        }
    },
    {
        connection: createRedisConnection(),
        concurrency: 5,
    }
);

deploymentWorker.on("completed", (job: Job, returnvalue: any) => {
    if (returnvalue && returnvalue.skipped) {
        console.log(`[Worker] Job ${job.id} skipped: ${returnvalue.reason}`);
    } else {
        console.log(`[Worker] Job ${job.id} completed successfully`);
    }
});

deploymentWorker.on("failed", (job: Job | undefined, err: Error) => {
    console.error(`[Worker] Job ${job?.id} failed: ${sanitizeLog(err.message)}`);
});

deploymentWorker.on("error", (err: Error) => {
    console.error(`[Worker] Worker error: ${sanitizeLog(err.message)}`);
});

// Graceful worker termination
async function handleShutdown(signal: string) {
    console.log(`[Worker] Received ${signal}. Shutting down worker and active deployments...`);
    try {
        await deploymentWorker.close();
        await runtimeService.stopAllProcesses();
    } catch (err: any) {
        console.error(`[Worker] Error during shutdown:`, err.message);
    } finally {
        process.exit(0);
    }
}

process.on("SIGINT", () => handleShutdown("SIGINT"));
process.on("SIGTERM", () => handleShutdown("SIGTERM"));

console.log("DevDeploy Deployment Worker initialized and listening for jobs on 'deployment' queue...");
