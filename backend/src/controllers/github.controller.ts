import { Request, Response } from "express";
import { githubService, GitHubError } from "../services/github.service";

export class GitHubController {
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
     * GET /api/github/repository/:projectId
     * Retrieves repository details from GitHub API for a user's project
     */
    async getRepository(req: Request, res: Response): Promise<void> {
        try {
            const userId = req.user?.userId;

            if (!userId) {
                res.status(401).json({
                    message: "User not authenticated",
                });
                return;
            }

            const projectId = this.parseId(req.params.projectId);
            if (projectId === null) {
                res.status(400).json({
                    message: "Invalid project ID parameter",
                });
                return;
            }

            const repository = await githubService.getProjectRepositoryInfo(projectId, userId);

            res.status(200).json({
                repository,
            });
        } catch (error: any) {
            if (error instanceof GitHubError) {
                res.status(error.statusCode).json({
                    message: error.message,
                });
                return;
            }

            console.error("Get GitHub repository error:", error);
            res.status(500).json({
                message: "Internal server error occurred while retrieving repository information",
            });
        }
    }
}

export const githubController = new GitHubController();
