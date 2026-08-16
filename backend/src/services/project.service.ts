import { prisma } from "../config/prisma";

export class ProjectError extends Error {
    statusCode: number;

    constructor(message: string, statusCode: number = 400) {
        super(message);
        this.name = "ProjectError";
        this.statusCode = statusCode;
    }
}

export interface CreateProjectInput {
    name: string;
    description?: string | null;
    repositoryUrl: string;
    userId: number;
    autoDeploy?: boolean;
    buildCommand?: string | null;
    startCommand?: string | null;
    rootDirectory?: string | null;
}

export interface UpdateProjectInput {
    name?: string;
    description?: string | null;
    repositoryUrl?: string;
    autoDeploy?: boolean;
    buildCommand?: string | null;
    startCommand?: string | null;
    rootDirectory?: string | null;
}

export class ProjectService {
    /**
     * Creates a new project for the specified user.
     */
    async createProject(input: CreateProjectInput) {
        const { name, description, repositoryUrl, userId, autoDeploy, buildCommand, startCommand, rootDirectory } = input;

        const project = await prisma.project.create({
            data: {
                name: name.trim(),
                description: description !== undefined && description !== null ? description.trim() : null,
                repositoryUrl: repositoryUrl.trim(),
                userId,
                ...(autoDeploy !== undefined ? { autoDeploy: Boolean(autoDeploy) } : {}),
                buildCommand: buildCommand !== undefined && buildCommand !== null ? (buildCommand.trim().length > 0 ? buildCommand.trim() : null) : null,
                startCommand: startCommand !== undefined && startCommand !== null ? (startCommand.trim().length > 0 ? startCommand.trim() : null) : null,
                rootDirectory: rootDirectory !== undefined && rootDirectory !== null ? (rootDirectory.trim().length > 0 ? rootDirectory.trim() : null) : null,
            },
        });

        return project;
    }

    /**
     * Retrieves all projects belonging to the authenticated user.
     */
    async getUserProjects(userId: number) {
        const projects = await prisma.project.findMany({
            where: { userId },
            orderBy: { createdAt: "desc" },
        });

        return projects;
    }

    /**
     * Retrieves a single project by ID, ensuring it belongs to the authenticated user.
     */
    async getProjectById(id: number, userId: number) {
        const project = await prisma.project.findFirst({
            where: { id, userId },
        });

        if (!project) {
            throw new ProjectError("Project not found", 404);
        }

        return project;
    }

    /**
     * Updates a project by ID, ensuring it belongs to the authenticated user.
     */
    async updateProject(id: number, userId: number, input: UpdateProjectInput) {
        const existing = await prisma.project.findFirst({
            where: { id, userId },
        });

        if (!existing) {
            throw new ProjectError("Project not found", 404);
        }

        const dataToUpdate: {
            name?: string;
            description?: string | null;
            repositoryUrl?: string;
            autoDeploy?: boolean;
            buildCommand?: string | null;
            startCommand?: string | null;
            rootDirectory?: string | null;
        } = {};

        if (input.name !== undefined) {
            dataToUpdate.name = input.name.trim();
        }

        if (input.description !== undefined) {
            dataToUpdate.description = input.description !== null ? input.description.trim() : null;
        }

        if (input.repositoryUrl !== undefined) {
            dataToUpdate.repositoryUrl = input.repositoryUrl.trim();
        }

        if (input.autoDeploy !== undefined) {
            dataToUpdate.autoDeploy = Boolean(input.autoDeploy);
        }

        if (input.buildCommand !== undefined) {
            dataToUpdate.buildCommand = input.buildCommand !== null && input.buildCommand.trim().length > 0
                ? input.buildCommand.trim()
                : null;
        }

        if (input.startCommand !== undefined) {
            dataToUpdate.startCommand = input.startCommand !== null && input.startCommand.trim().length > 0
                ? input.startCommand.trim()
                : null;
        }

        if (input.rootDirectory !== undefined) {
            dataToUpdate.rootDirectory = input.rootDirectory !== null && input.rootDirectory.trim().length > 0
                ? input.rootDirectory.trim()
                : null;
        }

        const updated = await prisma.project.update({
            where: { id },
            data: dataToUpdate,
        });

        return updated;
    }

    /**
     * Deletes a project by ID, ensuring it belongs to the authenticated user.
     */
    async deleteProject(id: number, userId: number) {
        const existing = await prisma.project.findFirst({
            where: { id, userId },
        });

        if (!existing) {
            throw new ProjectError("Project not found", 404);
        }

        await prisma.project.delete({
            where: { id },
        });

        return { message: "Project deleted successfully" };
    }
}

export const projectService = new ProjectService();
