import { prisma } from "../config/prisma";
import { DeploymentStatus } from "@prisma/client";
import { githubService, GitHubError } from "./github.service";
import { queueDeployment } from "./deployment.queue";
import { runtimeService } from "./runtime.service";

export class DeploymentError extends Error {
    statusCode: number;

    constructor(message: string, statusCode: number = 400) {
        super(message);
        this.name = "DeploymentError";
        this.statusCode = statusCode;
    }
}

export interface CreateDeploymentInput {
    commitHash?: string | null;
    branch?: string | null;
}

export class DeploymentService {
    /**
     * Helper to verify project ownership, throwing 404 if missing or 403 if unauthorized.
     */
    private async verifyProjectOwnership(projectId: number, userId: number) {
        const project = await prisma.project.findUnique({
            where: { id: projectId },
        });

        if (!project) {
            throw new DeploymentError("Project not found", 404);
        }

        if (project.userId !== userId) {
            throw new DeploymentError("Access forbidden: you do not own this project", 403);
        }

        return project;
    }

    /**
     * Helper to verify deployment ownership via its project, throwing 404 if missing or 403 if unauthorized.
     */
    private async verifyDeploymentOwnership(deploymentId: number, userId: number) {
        const deployment = await prisma.deployment.findUnique({
            where: { id: deploymentId },
            include: {
                project: {
                    select: {
                        id: true,
                        name: true,
                        description: true,
                        repositoryUrl: true,
                        userId: true,
                        createdAt: true,
                        updatedAt: true,
                    },
                },
            },
        });

        if (!deployment) {
            throw new DeploymentError("Deployment not found", 404);
        }

        if (deployment.project.userId !== userId) {
            throw new DeploymentError("Access forbidden: you do not own this deployment", 403);
        }

        return deployment;
    }

    /**
     * Triggers a new deployment pipeline step:
     * - Verifies project ownership (404/403)
     * - Queries GitHub API to find default branch and latest commit SHA
     * - Creates a Deployment record with status = PENDING
     * - Enqueues deployment job in BullMQ queue
     */
    async triggerDeployment(projectId: number, userId: number) {
        const project = await this.verifyProjectOwnership(projectId, userId);

        if (!project.repositoryUrl || typeof project.repositoryUrl !== "string" || project.repositoryUrl.trim().length === 0) {
            throw new DeploymentError("Project repository URL is missing or invalid", 400);
        }

        const { owner, repo } = githubService.parseRepositoryUrl(project.repositoryUrl);
        let defaultBranch = "main";
        let latestCommitSha: string | null = null;

        try {
            const repoInfo = await githubService.getRepositoryInfo(owner, repo);
            defaultBranch = repoInfo.default_branch || "main";
            latestCommitSha = await githubService.getLatestCommitSha(owner, repo, defaultBranch);
        } catch (error: any) {
            if (error instanceof GitHubError && error.statusCode === 404) {
                throw error;
            }
            console.warn(`[DeploymentService] GitHub API unavailable (${error.message}). Falling back to default branch '${defaultBranch}'.`);
        }

        const deployment = await prisma.deployment.create({
            data: {
                projectId,
                status: DeploymentStatus.PENDING,
                commitHash: latestCommitSha,
                branch: defaultBranch,
            },
        });

        // Enqueue deployment in BullMQ background job queue
        try {
            await queueDeployment(deployment.id);
        } catch (queueError: any) {
            console.error(`[DeploymentService] Failed to enqueue deployment job ${deployment.id}:`, queueError.message || queueError);
        }

        return deployment;
    }

    /**
     * Triggers an automated deployment from a webhook event:
     * - Creates a Deployment record with status = PENDING, commitHash, and branch
     * - Enqueues deployment job in BullMQ queue
     */
    async triggerAutoDeployment(projectId: number, commitHash: string, branch: string) {
        const deployment = await prisma.deployment.create({
            data: {
                projectId,
                status: DeploymentStatus.PENDING,
                commitHash: commitHash ? commitHash.trim() : null,
                branch: branch ? branch.trim() : null,
            },
        });

        // Enqueue deployment in BullMQ background job queue
        try {
            await queueDeployment(deployment.id);
        } catch (queueError: any) {
            console.error(`[DeploymentService] Failed to enqueue auto-deployment job ${deployment.id}:`, queueError.message || queueError);
        }

        return deployment;
    }

    /**
     * Rolls back a project to a specific previous deployment version:
     * - Verifies project ownership
     * - Finds target deployment record
     * - Creates a new Deployment with target commitHash and branch
     * - Enqueues deployment job
     */
    async rollbackDeployment(targetDeploymentId: number, userId: number) {
        const target = await prisma.deployment.findUnique({
            where: { id: targetDeploymentId },
            include: { project: true },
        });

        if (!target) {
            throw new DeploymentError("Target deployment to rollback to not found", 404);
        }

        if (target.project.userId !== userId) {
            throw new DeploymentError("Unauthorized to rollback this project", 403);
        }

        const newDeployment = await prisma.deployment.create({
            data: {
                projectId: target.projectId,
                status: DeploymentStatus.PENDING,
                commitHash: target.commitHash,
                branch: target.branch,
            },
        });

        try {
            await queueDeployment(newDeployment.id);
        } catch (queueError: any) {
            console.error(`[DeploymentService] Failed to enqueue rollback job ${newDeployment.id}:`, queueError.message || queueError);
        }

        return newDeployment;
    }

    /**
     * Retrieves the latest deployment for a project, ensuring user owns the project.
     * Returns null safely if no deployments exist yet.
     */
    async getLatestDeployment(projectId: number, userId: number) {
        await this.verifyProjectOwnership(projectId, userId);

        const deployment = await prisma.deployment.findFirst({
            where: { projectId },
            orderBy: { createdAt: "desc" },
            select: {
                id: true,
                projectId: true,
                status: true,
                commitHash: true,
                branch: true,
                runtimePort: true,
                deploymentUrl: true,
                createdAt: true,
                updatedAt: true,
            },
        });

        return deployment;
    }

    /**
     * Creates a new deployment in PENDING state after verifying project ownership.
     */
    async createDeployment(projectId: number, userId: number, input: CreateDeploymentInput) {
        await this.verifyProjectOwnership(projectId, userId);

        const deployment = await prisma.deployment.create({
            data: {
                projectId,
                status: DeploymentStatus.PENDING,
                commitHash: input.commitHash !== undefined && input.commitHash !== null ? input.commitHash.trim() : null,
                branch: input.branch !== undefined && input.branch !== null ? input.branch.trim() : null,
            },
        });

        return deployment;
    }

    /**
     * Retrieves all deployments for a project, ensuring user owns the project.
     * Sorted newest first without bulky logs.
     */
    async getProjectDeployments(projectId: number, userId: number) {
        await this.verifyProjectOwnership(projectId, userId);

        const deployments = await prisma.deployment.findMany({
            where: { projectId },
            orderBy: { createdAt: "desc" },
            select: {
                id: true,
                projectId: true,
                status: true,
                commitHash: true,
                branch: true,
                runtimePort: true,
                deploymentUrl: true,
                createdAt: true,
                updatedAt: true,
            },
        });

        return deployments;
    }

    /**
     * Retrieves a single deployment by ID, ensuring user owns the associated project.
     */
    async getDeploymentById(deploymentId: number, userId: number) {
        const deployment = await this.verifyDeploymentOwnership(deploymentId, userId);

        return {
            id: deployment.id,
            projectId: deployment.projectId,
            status: deployment.status,
            commitHash: deployment.commitHash,
            branch: deployment.branch,
            runtimePort: deployment.runtimePort,
            deploymentUrl: deployment.deploymentUrl,
            createdAt: deployment.createdAt,
            updatedAt: deployment.updatedAt,
            project: {
                id: deployment.project.id,
                name: deployment.project.name,
                description: deployment.project.description,
                repositoryUrl: deployment.project.repositoryUrl,
                createdAt: deployment.project.createdAt,
                updatedAt: deployment.project.updatedAt,
            },
        };
    }

    /**
     * Retrieves deployment status and details, ensuring user owns the associated project.
     */
    async getDeploymentStatus(deploymentId: number, userId: number) {
        const deployment = await this.verifyDeploymentOwnership(deploymentId, userId);

        return {
            deploymentId: deployment.id,
            status: deployment.status,
            deploymentUrl: deployment.deploymentUrl,
            runtimePort: deployment.runtimePort,
            updatedAt: deployment.updatedAt,
        };
    }

    /**
     * Stops a running deployment process, updating its status and terminating the child process.
     */
    async stopDeployment(deploymentId: number, userId: number) {
        const deployment = await this.verifyDeploymentOwnership(deploymentId, userId);

        if (
            deployment.status !== DeploymentStatus.RUNNING &&
            deployment.status !== DeploymentStatus.BUILDING &&
            deployment.status !== DeploymentStatus.PENDING
        ) {
            throw new DeploymentError(
                `Cannot stop deployment with status '${deployment.status}'. Only active deployments can be stopped.`,
                400
            );
        }

        // Terminate running child process if registered
        await runtimeService.stopDeploymentProcess(deploymentId);

        // Update deployment record
        const updated = await prisma.deployment.update({
            where: { id: deploymentId },
            data: {
                status: DeploymentStatus.FAILED,
            },
        });

        // Add log entry
        await prisma.deploymentLog.create({
            data: {
                deploymentId,
                message: "Deployment stopped by user",
            },
        });

        return updated;
    }

    /**
     * Updates deployment status and optional deployment URL, ensuring user owns the associated project.
     */
    async updateDeploymentStatus(
        deploymentId: number,
        userId: number,
        status: DeploymentStatus,
        deploymentUrl?: string | null
    ) {
        await this.verifyDeploymentOwnership(deploymentId, userId);

        const updated = await prisma.deployment.update({
            where: { id: deploymentId },
            data: {
                status,
                ...(deploymentUrl !== undefined
                    ? { deploymentUrl: deploymentUrl !== null ? deploymentUrl.trim() : null }
                    : {}),
            },
        });

        return updated;
    }

    /**
     * Retrieves all logs for a deployment in ascending chronological order, ensuring user owns the associated project.
     */
    async getDeploymentLogs(deploymentId: number, userId: number) {
        await this.verifyDeploymentOwnership(deploymentId, userId);

        const logs = await prisma.deploymentLog.findMany({
            where: { deploymentId },
            orderBy: { createdAt: "asc" },
            select: {
                id: true,
                deploymentId: true,
                message: true,
                createdAt: true,
            },
        });

        return logs;
    }
}

export const deploymentService = new DeploymentService();
