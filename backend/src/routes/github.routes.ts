import { Router } from "express";
import { githubController } from "../controllers/github.controller";
import { authenticateToken } from "../middleware/auth.middleware";

const router = Router();

// Protect all GitHub routes with JWT authentication
router.use(authenticateToken);

router.get("/repository/:projectId", (req, res) => githubController.getRepository(req, res));

export default router;
