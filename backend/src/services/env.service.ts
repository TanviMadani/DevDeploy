import { prisma } from "../config/prisma";

export class EnvError extends Error {
    statusCode: number;

    constructor(message: string, statusCode: number = 400) {
        super(message);
        this.name = "EnvError";
        this.statusCode = statusCode;
    }
}

export class EnvService {
    private async verifyOwnership(projectId: number, userId: number) {
        const project = await prisma.project.findUnique({
            where: { id: projectId },
        });

        if (!project) {
            throw new EnvError("Project not found", 404);
        }

        if (project.userId !== userId) {
            throw new EnvError("Unauthorized to manage environment variables for this project", 403);
        }

        return project;
    }

    /**
     * Retrieve all environment variables for a project.
     */
    async getEnvVariables(projectId: number, userId: number) {
        await this.verifyOwnership(projectId, userId);

        return prisma.environmentVariable.findMany({
            where: { projectId },
            orderBy: { key: "asc" },
            select: {
                id: true,
                key: true,
                value: true,
                createdAt: true,
                updatedAt: true,
            },
        });
    }

    /**
     * Create or update an environment variable.
     */
    async upsertEnvVariable(projectId: number, userId: number, key: string, value: string) {
        await this.verifyOwnership(projectId, userId);

        const trimmedKey = key?.trim();
        if (!trimmedKey) {
            throw new EnvError("Environment variable key is required", 400);
        }

        const validKeyRegex = /^[a-zA-Z_][a-zA-Z0-9_]*$/;
        if (!validKeyRegex.test(trimmedKey)) {
            throw new EnvError("Variable key must start with a letter or underscore and contain only letters, numbers, and underscores", 400);
        }

        const trimmedVal = typeof value === "string" ? value : "";

        return prisma.environmentVariable.upsert({
            where: {
                projectId_key: {
                    projectId,
                    key: trimmedKey,
                },
            },
            update: {
                value: trimmedVal,
            },
            create: {
                projectId,
                key: trimmedKey,
                value: trimmedVal,
            },
        });
    }

    /**
     * Delete an environment variable by ID.
     */
    async deleteEnvVariable(projectId: number, userId: number, envId: number) {
        await this.verifyOwnership(projectId, userId);

        const envVar = await prisma.environmentVariable.findUnique({
            where: { id: envId },
        });

        if (!envVar || envVar.projectId !== projectId) {
            throw new EnvError("Environment variable not found", 404);
        }

        await prisma.environmentVariable.delete({
            where: { id: envId },
        });

        return { success: true };
    }

    /**
     * Internal helper to load key-value map of environment variables for worker execution.
     */
    async getProjectEnvMap(projectId: number): Promise<Record<string, string>> {
        const envVars = await prisma.environmentVariable.findMany({
            where: { projectId },
        });

        const envMap: Record<string, string> = {};
        for (const item of envVars) {
            envMap[item.key] = item.value;
        }

        return envMap;
    }
}

export const envService = new EnvService();
