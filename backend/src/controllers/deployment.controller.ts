import { Request, Response } from "express";
import { deploymentService, DeploymentError } from "../services/deployment.service";
import { GitHubError } from "../services/github.service";
import { DeploymentStatus } from "@prisma/client";

const VALID_STATUSES: string[] = Object.values(DeploymentStatus);

export class DeploymentController {
    /**
     * Helper to safely extract integer ID from request params
     */
    private parseId(param: string | string[] | undefined): number | null {
        if (!param) return null;
        const idStr = Array.isArray(param) ? param[0] : param;
        const parsed = parseInt(idStr, 10);
        return isNaN(parsed) || parsed <= 0 ? null : parsed;
    }

    /**
     * POST /api/projects/:projectId/deploy
     * Triggers a new deployment pipeline step for the project
     */
    async triggerDeployment(req: Request, res: Response): Promise<void> {
        try {
            const userId = req.user?.userId;

            if (!userId) {
                res.status(401).json({
                    message: "User not authenticated",
                });
                return;
            }

            const projectId = this.parseId(req.params.projectId || req.params.id);
            if (projectId === null) {
                res.status(400).json({
                    message: "Invalid project ID parameter",
                });
                return;
            }

            const deployment = await deploymentService.triggerDeployment(projectId, userId);

            res.status(201).json({
                message: "Deployment triggered successfully",
                deployment,
            });
        } catch (error: any) {
            if (error instanceof DeploymentError || error instanceof GitHubError) {
                res.status(error.statusCode).json({
                    message: error.message,
                });
                return;
            }

            console.error("Trigger deployment error:", error);
            res.status(500).json({
                message: "Internal server error occurred while triggering deployment",
            });
        }
    }

    /**
     * POST /api/projects/:projectId/deployments
     * Initiates a new deployment for the specified project in PENDING state
     */
    async createDeployment(req: Request, res: Response): Promise<void> {
        try {
            const userId = req.user?.userId;

            if (!userId) {
                res.status(401).json({
                    message: "User not authenticated",
                });
                return;
            }

            const projectId = this.parseId(req.params.projectId || req.params.id);
            if (projectId === null) {
                res.status(400).json({
                    message: "Invalid project ID parameter",
                });
                return;
            }

            const { commitHash, branch } = req.body;

            if (commitHash !== undefined && commitHash !== null && typeof commitHash !== "string") {
                res.status(400).json({
                    message: "commitHash must be a string if provided.",
                });
                return;
            }

            if (branch !== undefined && branch !== null && typeof branch !== "string") {
                res.status(400).json({
                    message: "branch must be a string if provided.",
                });
                return;
            }

            const deployment = await deploymentService.createDeployment(projectId, userId, {
                commitHash,
                branch,
            });

            res.status(201).json({
                message: "Deployment created successfully",
                deployment,
            });
        } catch (error: any) {
            if (error instanceof DeploymentError || error instanceof GitHubError) {
                res.status(error.statusCode).json({
                    message: error.message,
                });
                return;
            }

            console.error("Create deployment error:", error);
            res.status(500).json({
                message: "Internal server error occurred while creating deployment",
            });
        }
    }

    /**
     * GET /api/projects/:projectId/deployments
     * Retrieves all deployments for a specified project
     */
    async getProjectDeployments(req: Request, res: Response): Promise<void> {
        try {
            const userId = req.user?.userId;

            if (!userId) {
                res.status(401).json({
                    message: "User not authenticated",
                });
                return;
            }

            const projectId = this.parseId(req.params.projectId || req.params.id);
            if (projectId === null) {
                res.status(400).json({
                    message: "Invalid project ID parameter",
                });
                return;
            }

            const deployments = await deploymentService.getProjectDeployments(projectId, userId);

            res.status(200).json({
                deployments,
            });
        } catch (error: any) {
            if (error instanceof DeploymentError || error instanceof GitHubError) {
                res.status(error.statusCode).json({
                    message: error.message,
                });
                return;
            }

            console.error("Get project deployments error:", error);
            res.status(500).json({
                message: "Internal server error occurred while retrieving deployments",
            });
        }
    }

    /**
     * GET /api/projects/:projectId/deployments/latest
     * Retrieves the latest deployment for a specified project
     */
    async getLatestDeployment(req: Request, res: Response): Promise<void> {
        try {
            const userId = req.user?.userId;

            if (!userId) {
                res.status(401).json({
                    message: "User not authenticated",
                });
                return;
            }

            const projectId = this.parseId(req.params.projectId || req.params.id);
            if (projectId === null) {
                res.status(400).json({
                    message: "Invalid project ID parameter",
                });
                return;
            }

            const deployment = await deploymentService.getLatestDeployment(projectId, userId);

            if (!deployment) {
                res.status(200).json({
                    message: "No deployments found for this project",
                    deployment: null,
                });
                return;
            }

            res.status(200).json({
                deployment,
            });
        } catch (error: any) {
            if (error instanceof DeploymentError || error instanceof GitHubError) {
                res.status(error.statusCode).json({
                    message: error.message,
                });
                return;
            }

            console.error("Get latest deployment error:", error);
            res.status(500).json({
                message: "Internal server error occurred while retrieving latest deployment",
            });
        }
    }

    /**
     * GET /api/deployments/:id
     * Retrieves a single deployment by ID
     */
    async getDeploymentById(req: Request, res: Response): Promise<void> {
        try {
            const userId = req.user?.userId;

            if (!userId) {
                res.status(401).json({
                    message: "User not authenticated",
                });
                return;
            }

            const deploymentId = this.parseId(req.params.deploymentId || req.params.id);
            if (deploymentId === null) {
                res.status(400).json({
                    message: "Invalid deployment ID parameter",
                });
                return;
            }

            const deployment = await deploymentService.getDeploymentById(deploymentId, userId);

            res.status(200).json({
                deployment,
            });
        } catch (error: any) {
            if (error instanceof DeploymentError || error instanceof GitHubError) {
                res.status(error.statusCode).json({
                    message: error.message,
                });
                return;
            }

            console.error("Get deployment by ID error:", error);
            res.status(500).json({
                message: "Internal server error occurred while retrieving deployment",
            });
        }
    }

    /**
     * GET /api/deployments/:id/status
     * Retrieves status metadata for a deployment
     */
    async getDeploymentStatus(req: Request, res: Response): Promise<void> {
        try {
            const userId = req.user?.userId;

            if (!userId) {
                res.status(401).json({
                    message: "User not authenticated",
                });
                return;
            }

            const deploymentId = this.parseId(req.params.deploymentId || req.params.id);
            if (deploymentId === null) {
                res.status(400).json({
                    message: "Invalid deployment ID parameter",
                });
                return;
            }

            const statusInfo = await deploymentService.getDeploymentStatus(deploymentId, userId);

            res.status(200).json(statusInfo);
        } catch (error: any) {
            if (error instanceof DeploymentError || error instanceof GitHubError) {
                res.status(error.statusCode).json({
                    message: error.message,
                });
                return;
            }

            console.error("Get deployment status error:", error);
            res.status(500).json({
                message: "Internal server error occurred while retrieving deployment status",
            });
        }
    }

    /**
     * PATCH /api/deployments/:id/status
     * Updates deployment status and optional deploymentUrl
     */
    async updateDeploymentStatus(req: Request, res: Response): Promise<void> {
        try {
            const userId = req.user?.userId;

            if (!userId) {
                res.status(401).json({
                    message: "User not authenticated",
                });
                return;
            }

            const deploymentId = this.parseId(req.params.deploymentId || req.params.id);
            if (deploymentId === null) {
                res.status(400).json({
                    message: "Invalid deployment ID parameter",
                });
                return;
            }

            const { status, deploymentUrl } = req.body;

            if (!status || typeof status !== "string" || !VALID_STATUSES.includes(status)) {
                res.status(400).json({
                    message: `Invalid status. Must be one of: ${VALID_STATUSES.join(", ")}`,
                });
                return;
            }

            if (deploymentUrl !== undefined && deploymentUrl !== null && typeof deploymentUrl !== "string") {
                res.status(400).json({
                    message: "deploymentUrl must be a string or null if provided.",
                });
                return;
            }

            const deployment = await deploymentService.updateDeploymentStatus(
                deploymentId,
                userId,
                status as DeploymentStatus,
                deploymentUrl
            );

            res.status(200).json({
                message: "Deployment updated successfully",
                deployment,
            });
        } catch (error: any) {
            if (error instanceof DeploymentError || error instanceof GitHubError) {
                res.status(error.statusCode).json({
                    message: error.message,
                });
                return;
            }

            console.error("Update deployment status error:", error);
            res.status(500).json({
                message: "Internal server error occurred while updating deployment status",
            });
        }
    }

    /**
     * GET /api/deployments/:id/logs
     * Retrieves all logs for a deployment in ascending chronological order
     */
    async getDeploymentLogs(req: Request, res: Response): Promise<void> {
        try {
            const userId = req.user?.userId;

            if (!userId) {
                res.status(401).json({
                    message: "User not authenticated",
                });
                return;
            }

            const deploymentId = this.parseId(req.params.deploymentId || req.params.id);
            if (deploymentId === null) {
                res.status(400).json({
                    message: "Invalid deployment ID parameter",
                });
                return;
            }

            const logs = await deploymentService.getDeploymentLogs(deploymentId, userId);

            res.status(200).json({
                logs,
            });
        } catch (error: any) {
            if (error instanceof DeploymentError || error instanceof GitHubError) {
                res.status(error.statusCode).json({
                    message: error.message,
                });
                return;
            }

            console.error("Get deployment logs error:", error);
            res.status(500).json({
                message: "Internal server error occurred while retrieving deployment logs",
            });
        }
    }

    /**
     * POST /api/deployments/:id/stop
     * Stops a running deployment process
     */
    async stopDeployment(req: Request, res: Response): Promise<void> {
        try {
            const userId = req.user?.userId;

            if (!userId) {
                res.status(401).json({
                    message: "User not authenticated",
                });
                return;
            }

            const deploymentId = this.parseId(req.params.deploymentId || req.params.id);
            if (deploymentId === null) {
                res.status(400).json({
                    message: "Invalid deployment ID parameter",
                });
                return;
            }

            const deployment = await deploymentService.stopDeployment(deploymentId, userId);

            res.status(200).json({
                message: "Deployment stopped successfully",
                deployment,
            });
        } catch (error: any) {
            if (error instanceof DeploymentError || error instanceof GitHubError) {
                res.status(error.statusCode).json({
                    message: error.message,
                });
                return;
            }

            console.error("Stop deployment error:", error);
            res.status(500).json({
                message: "Internal server error occurred while stopping deployment",
            });
        }
    }
}

export const deploymentController = new DeploymentController();
