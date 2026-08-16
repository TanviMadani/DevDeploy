import { Router } from "express";
import { webhookController } from "../controllers/webhook.controller";

const router = Router();

// POST /api/webhooks/github - Public endpoint with HMAC-SHA256 signature verification (No JWT)
router.post("/github", (req, res) => webhookController.handleGitHubWebhook(req, res));

export default router;
