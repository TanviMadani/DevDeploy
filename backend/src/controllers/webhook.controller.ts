import { Request, Response } from "express";
import { webhookService, WebhookError } from "../services/webhook.service";

export class WebhookController {
    /**
     * POST /api/webhooks/github
     * Receives, authenticates, and processes GitHub push webhooks.
     */
    async handleGitHubWebhook(req: Request, res: Response): Promise<void> {
        try {
            const rawBody = (req as any).rawBody || (Buffer.isBuffer(req.body) ? req.body : undefined);

            const result = await webhookService.processGitHubWebhook({
                rawBody,
                headers: req.headers,
                payload: req.body,
            });

            res.status(result.statusCode).json(result);
        } catch (error: any) {
            if (error instanceof WebhookError) {
                res.status(error.statusCode).json({
                    message: error.message,
                });
                return;
            }

            console.error("[WebhookController] Unexpected error handling GitHub webhook:", error);
            res.status(500).json({
                message: "Internal server error occurred while processing webhook.",
            });
        }
    }
}

export const webhookController = new WebhookController();
