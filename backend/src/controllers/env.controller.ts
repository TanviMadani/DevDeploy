import { Request, Response } from "express";
import { envService, EnvError } from "../services/env.service";

export class EnvController {
    private parseId(param: string | string[] | undefined): number | null {
        if (!param) return null;
        const idStr = Array.isArray(param) ? param[0] : param;
        const parsed = parseInt(idStr, 10);
        return isNaN(parsed) || parsed <= 0 ? null : parsed;
    }

    async getEnvVariables(req: Request, res: Response): Promise<void> {
        try {
            const userId = req.user?.userId;
            if (!userId) {
                res.status(401).json({ message: "User not authenticated" });
                return;
            }

            const projectId = this.parseId(req.params.projectId || req.params.id);
            if (projectId === null) {
                res.status(400).json({ message: "Invalid project ID" });
                return;
            }

            const envVars = await envService.getEnvVariables(projectId, userId);
            res.status(200).json({ envVars });
        } catch (error: any) {
            if (error instanceof EnvError) {
                res.status(error.statusCode).json({ message: error.message });
                return;
            }
            console.error("Get env variables error:", error);
            res.status(500).json({ message: "Internal server error occurred" });
        }
    }

    async upsertEnvVariable(req: Request, res: Response): Promise<void> {
        try {
            const userId = req.user?.userId;
            if (!userId) {
                res.status(401).json({ message: "User not authenticated" });
                return;
            }

            const projectId = this.parseId(req.params.projectId || req.params.id);
            if (projectId === null) {
                res.status(400).json({ message: "Invalid project ID" });
                return;
            }

            const { key, value } = req.body;
            const envVar = await envService.upsertEnvVariable(projectId, userId, key, value);

            res.status(200).json({
                message: "Environment variable saved successfully",
                envVar,
            });
        } catch (error: any) {
            if (error instanceof EnvError) {
                res.status(error.statusCode).json({ message: error.message });
                return;
            }
            console.error("Upsert env variable error:", error);
            res.status(500).json({ message: "Internal server error occurred" });
        }
    }

    async deleteEnvVariable(req: Request, res: Response): Promise<void> {
        try {
            const userId = req.user?.userId;
            if (!userId) {
                res.status(401).json({ message: "User not authenticated" });
                return;
            }

            const projectId = this.parseId(req.params.projectId);
            const envId = this.parseId(req.params.envId || req.params.id);

            if (projectId === null || envId === null) {
                res.status(400).json({ message: "Invalid project or variable ID" });
                return;
            }

            await envService.deleteEnvVariable(projectId, userId, envId);

            res.status(200).json({ message: "Environment variable deleted successfully" });
        } catch (error: any) {
            if (error instanceof EnvError) {
                res.status(error.statusCode).json({ message: error.message });
                return;
            }
            console.error("Delete env variable error:", error);
            res.status(500).json({ message: "Internal server error occurred" });
        }
    }
}

export const envController = new EnvController();
