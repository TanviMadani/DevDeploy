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

import { envService } from "../services/env.service";
import { logEmitter } from "../utils/logEmitter";

export interface ResolvedDirectoryResult {
    workDir: string;
    autoDetected?: string;
}

/**
 * Resolves and securely validates the deployment working directory based on the project rootDirectory.
 * If not specified, automatically detects project subdirectories containing package.json or index.html.
 * Prevents path traversal outside the cloned workspace root.
 */
export function resolveDeploymentDirectory(
    repoRoot: string,
    rootDirectory?: string | null
): ResolvedDirectoryResult {
    if (rootDirectory && rootDirectory.trim().length > 0 && rootDirectory.trim() !== "./" && rootDirectory.trim() !== ".") {
        const trimmed = rootDirectory.trim();
        // Resolve target path relative to repoRoot
        const targetPath = path.resolve(repoRoot, trimmed);
        const relative = path.relative(repoRoot, targetPath);

        // Path traversal check: must not escape repoRoot
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

        return { workDir: targetPath };
    }

    // Check if root already has package.json or index.html
    const rootPackageJson = path.join(repoRoot, "package.json");
    const rootIndexHtml = path.join(repoRoot, "index.html");
    if (fs.existsSync(rootPackageJson) || fs.existsSync(rootIndexHtml)) {
        return { workDir: repoRoot };
    }

    // Scan subdirectories for package.json or index.html
    try {
        const entries = fs.readdirSync(repoRoot, { withFileTypes: true });
        const candidateDirs: string[] = [];

        for (const entry of entries) {
            if (entry.isDirectory() && !entry.name.startsWith(".") && entry.name !== "node_modules" && entry.name !== "dist" && entry.name !== "build") {
                const subDir = path.join(repoRoot, entry.name);
                if (fs.existsSync(path.join(subDir, "package.json")) || fs.existsSync(path.join(subDir, "index.html"))) {
                    candidateDirs.push(entry.name);
                }
            }
        }

        if (candidateDirs.length === 1) {
            const detected = candidateDirs[0];
            return {
                workDir: path.join(repoRoot, detected),
                autoDetected: detected,
            };
        }

        if (candidateDirs.length > 1) {
            // Prioritize frontend/client naming conventions
            const preferred = candidateDirs.find((dir) =>
                /^(frontend|client|web|ui|app|.*-frontend|.*-client|.*-web)$/i.test(dir)
            );
            if (preferred) {
                return {
                    workDir: path.join(repoRoot, preferred),
                    autoDetected: preferred,
                };
            }
            // Default to first matching candidate
            return {
                workDir: path.join(repoRoot, candidateDirs[0]),
                autoDetected: candidateDirs[0],
            };
        }

        // List all directory names found to help the user
        const allDirs = entries.filter((e) => e.isDirectory() && !e.name.startsWith(".")).map((e) => e.name);
        const subMsg = allDirs.length > 0 ? ` Found directories: [${allDirs.join(", ")}].` : "";
        throw new Error(`Project inspection failed: no package.json or index.html found in repository root.${subMsg} Please set 'rootDirectory' in project settings.`);
    } catch (err: any) {
        if (err.message.includes("Project inspection failed")) {
            throw err;
        }
        return { workDir: repoRoot };
    }
}

/**
 * Persists a log entry for a specific deployment in the database and broadcasts via SSE logEmitter.
 */
async function addDeploymentLog(deploymentId: number, message: string): Promise<void> {
    try {
        const sanitized = sanitizeLog(message);
        await prisma.deploymentLog.create({
            data: {
                deploymentId,
                message: sanitized,
            },
        });
        logEmitter.emitLog(deploymentId, sanitized);
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

            // Load project environment variables
            const envMap = await envService.getProjectEnvMap(deployment.projectId);
            const envCount = Object.keys(envMap).length;

            // Log: deployment started
            await addDeploymentLog(deploymentId, `Deployment started for project '${deployment.project.name}'`);
            if (envCount > 0) {
                await addDeploymentLog(deploymentId, `Loaded ${envCount} project environment variable(s).`);
            }

            // Update status to BUILDING
            await prisma.deployment.update({
                where: { id: deploymentId },
                data: { status: DeploymentStatus.BUILDING },
            });
            logEmitter.emitStatus(deploymentId, DeploymentStatus.BUILDING);

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

            if (checkoutResult.commitHash && !deployment.commitHash) {
                await prisma.deployment.update({
                    where: { id: deploymentId },
                    data: { commitHash: checkoutResult.commitHash },
                });
            }

            // Resolve effective working directory from project rootDirectory setting or auto-detection
            const resolved = resolveDeploymentDirectory(
                repoRoot,
                deployment.project.rootDirectory
            );
            const effectiveWorkDir = resolved.workDir;

            if (deployment.project.rootDirectory && deployment.project.rootDirectory.trim().length > 0 && deployment.project.rootDirectory.trim() !== "./") {
                await addDeploymentLog(
                    deploymentId,
                    `Using configured rootDirectory: '${deployment.project.rootDirectory.trim()}'`
                );
            } else if (resolved.autoDetected) {
                await addDeploymentLog(
                    deploymentId,
                    `Auto-detected project directory: '${resolved.autoDetected}'`
                );
            }

            // Stage 2: Perform application build (inspect, install dependencies, run build step)
            await buildService.buildProject({
                deploymentId,
                workDir: effectiveWorkDir,
                buildCommand: deployment.project.buildCommand,
                envVars: envMap,
                onLog: async (message: string) => {
                    await addDeploymentLog(deploymentId, message);
                },
            });

            // Update status to RUNNING
            await prisma.deployment.update({
                where: { id: deploymentId },
                data: { status: DeploymentStatus.RUNNING },
            });
            logEmitter.emitStatus(deploymentId, DeploymentStatus.RUNNING);
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
                envVars: envMap,
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
            logEmitter.emitStatus(deploymentId, DeploymentStatus.SUCCESS);

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
                logEmitter.emitStatus(deploymentId, DeploymentStatus.FAILED);
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
