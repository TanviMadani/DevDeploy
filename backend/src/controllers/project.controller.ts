import { Request, Response } from "express";
import { projectService, ProjectError } from "../services/project.service";

export class ProjectController {
    /**
     * Helper to safely extract integer ID from request params
     */
    private parseId(param: string | string[] | undefined): number | null {
        if (!param) return null;
        const idStr = Array.isArray(param) ? param[0] : param;
        const parsed = parseInt(idStr, 10);
        return isNaN(parsed) ? null : parsed;
    }

    /**
     * POST /api/projects
     * Creates a new project for the authenticated user
     */
    async createProject(req: Request, res: Response): Promise<void> {
        try {
            const userId = req.user?.userId;

            if (!userId) {
                res.status(401).json({
                    message: "User not authenticated",
                });
                return;
            }

            const { name, description, repositoryUrl, autoDeploy, buildCommand, startCommand, rootDirectory } = req.body;

            if (!name || typeof name !== "string" || name.trim().length === 0) {
                res.status(400).json({
                    message: "Project name is required and must be a non-empty string.",
                });
                return;
            }

            if (!repositoryUrl || typeof repositoryUrl !== "string" || repositoryUrl.trim().length === 0) {
                res.status(400).json({
                    message: "Repository URL is required and must be a non-empty string.",
                });
                return;
            }

            if (description !== undefined && description !== null && typeof description !== "string") {
                res.status(400).json({
                    message: "Description must be a string if provided.",
                });
                return;
            }

            if (autoDeploy !== undefined && typeof autoDeploy !== "boolean") {
                res.status(400).json({
                    message: "autoDeploy must be a boolean if provided.",
                });
                return;
            }

            if (buildCommand !== undefined && buildCommand !== null && typeof buildCommand !== "string") {
                res.status(400).json({
                    message: "buildCommand must be a string or null if provided.",
                });
                return;
            }

            if (startCommand !== undefined && startCommand !== null && typeof startCommand !== "string") {
                res.status(400).json({
                    message: "startCommand must be a string or null if provided.",
                });
                return;
            }

            if (rootDirectory !== undefined && rootDirectory !== null && typeof rootDirectory !== "string") {
                res.status(400).json({
                    message: "rootDirectory must be a string or null if provided.",
                });
                return;
            }

            const project = await projectService.createProject({
                name,
                description,
                repositoryUrl,
                userId,
                autoDeploy,
                buildCommand,
                startCommand,
                rootDirectory,
            });

            res.status(201).json({
                message: "Project created successfully",
                project,
            });
        } catch (error: any) {
            if (error instanceof ProjectError) {
                res.status(error.statusCode).json({
                    message: error.message,
                });
                return;
            }

            console.error("Create project error:", error);
            res.status(500).json({
                message: "Internal server error occurred while creating project",
            });
        }
    }

    /**
     * GET /api/projects
     * Retrieves all projects belonging to the authenticated user
     */
    async getUserProjects(req: Request, res: Response): Promise<void> {
        try {
            const userId = req.user?.userId;

            if (!userId) {
                res.status(401).json({
                    message: "User not authenticated",
                });
                return;
            }

            const projects = await projectService.getUserProjects(userId);

            res.status(200).json({
                projects,
            });
        } catch (error: any) {
            if (error instanceof ProjectError) {
                res.status(error.statusCode).json({
                    message: error.message,
                });
                return;
            }

            console.error("Get user projects error:", error);
            res.status(500).json({
                message: "Internal server error occurred while retrieving projects",
            });
        }
    }

    /**
     * GET /api/projects/:id
     * Retrieves a single project by ID for the authenticated user
     */
    async getProjectById(req: Request, res: Response): Promise<void> {
        try {
            const userId = req.user?.userId;

            if (!userId) {
                res.status(401).json({
                    message: "User not authenticated",
                });
                return;
            }

            const projectId = this.parseId(req.params.id);
            if (projectId === null) {
                res.status(400).json({
                    message: "Invalid project ID parameter",
                });
                return;
            }

            const project = await projectService.getProjectById(projectId, userId);

            res.status(200).json({
                project,
            });
        } catch (error: any) {
            if (error instanceof ProjectError) {
                res.status(error.statusCode).json({
                    message: error.message,
                });
                return;
            }

            console.error("Get project by ID error:", error);
            res.status(500).json({
                message: "Internal server error occurred while retrieving project",
            });
        }
    }

    /**
     * PUT /api/projects/:id
     * Updates a project by ID for the authenticated user
     */
    async updateProject(req: Request, res: Response): Promise<void> {
        try {
            const userId = req.user?.userId;

            if (!userId) {
                res.status(401).json({
                    message: "User not authenticated",
                });
                return;
            }

            const projectId = this.parseId(req.params.id || req.params.projectId);
            if (projectId === null) {
                res.status(400).json({
                    message: "Invalid project ID parameter",
                });
                return;
            }

            const { name, description, repositoryUrl, autoDeploy, buildCommand, startCommand, rootDirectory } = req.body;

            if (
                name === undefined &&
                description === undefined &&
                repositoryUrl === undefined &&
                autoDeploy === undefined &&
                buildCommand === undefined &&
                startCommand === undefined &&
                rootDirectory === undefined
            ) {
                res.status(400).json({
                    message:
                        "At least one field (name, description, repositoryUrl, autoDeploy, buildCommand, startCommand, or rootDirectory) must be provided for update.",
                });
                return;
            }

            if (name !== undefined && (typeof name !== "string" || name.trim().length === 0)) {
                res.status(400).json({
                    message: "Project name must be a non-empty string if provided.",
                });
                return;
            }

            if (repositoryUrl !== undefined && (typeof repositoryUrl !== "string" || repositoryUrl.trim().length === 0)) {
                res.status(400).json({
                    message: "Repository URL must be a non-empty string if provided.",
                });
                return;
            }

            if (description !== undefined && description !== null && typeof description !== "string") {
                res.status(400).json({
                    message: "Description must be a string or null if provided.",
                });
                return;
            }

            if (autoDeploy !== undefined && typeof autoDeploy !== "boolean") {
                res.status(400).json({
                    message: "autoDeploy must be a boolean if provided.",
                });
                return;
            }

            if (buildCommand !== undefined && buildCommand !== null && typeof buildCommand !== "string") {
                res.status(400).json({
                    message: "buildCommand must be a string or null if provided.",
                });
                return;
            }

            if (startCommand !== undefined && startCommand !== null && typeof startCommand !== "string") {
                res.status(400).json({
                    message: "startCommand must be a string or null if provided.",
                });
                return;
            }

            if (rootDirectory !== undefined && rootDirectory !== null && typeof rootDirectory !== "string") {
                res.status(400).json({
                    message: "rootDirectory must be a string or null if provided.",
                });
                return;
            }

            const project = await projectService.updateProject(projectId, userId, {
                name,
                description,
                repositoryUrl,
                autoDeploy,
                buildCommand,
                startCommand,
                rootDirectory,
            });

            res.status(200).json({
                message: "Project updated successfully",
                project,
            });
        } catch (error: any) {
            if (error instanceof ProjectError) {
                res.status(error.statusCode).json({
                    message: error.message,
                });
                return;
            }

            console.error("Update project error:", error);
            res.status(500).json({
                message: "Internal server error occurred while updating project",
            });
        }
    }

    /**
     * DELETE /api/projects/:id
     * Deletes a project by ID for the authenticated user
     */
    async deleteProject(req: Request, res: Response): Promise<void> {
        try {
            const userId = req.user?.userId;

            if (!userId) {
                res.status(401).json({
                    message: "User not authenticated",
                });
                return;
            }

            const projectId = this.parseId(req.params.id);
            if (projectId === null) {
                res.status(400).json({
                    message: "Invalid project ID parameter",
                });
                return;
            }

            const result = await projectService.deleteProject(projectId, userId);

            res.status(200).json(result);
        } catch (error: any) {
            if (error instanceof ProjectError) {
                res.status(error.statusCode).json({
                    message: error.message,
                });
                return;
            }

            console.error("Delete project error:", error);
            res.status(500).json({
                message: "Internal server error occurred while deleting project",
            });
        }
    }
}

export const projectController = new ProjectController();
