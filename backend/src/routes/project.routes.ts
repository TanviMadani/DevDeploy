import { Router } from "express";
import { projectController } from "../controllers/project.controller";
import { deploymentController } from "../controllers/deployment.controller";
import { authenticateToken } from "../middleware/auth.middleware";
import { projectDeploymentRouter } from "./deployment.routes";

const router = Router();

// Protect all project routes with JWT authentication
router.use(authenticateToken);

router.post("/", (req, res) => projectController.createProject(req, res));
router.get("/", (req, res) => projectController.getUserProjects(req, res));
router.get("/:id", (req, res) => projectController.getProjectById(req, res));
router.put("/:id", (req, res) => projectController.updateProject(req, res));
router.patch("/:id", (req, res) => projectController.updateProject(req, res));
router.delete("/:id", (req, res) => projectController.deleteProject(req, res));

// Trigger deployment pipeline for a project: POST /api/projects/:projectId/deploy
router.post("/:projectId/deploy", (req, res) => deploymentController.triggerDeployment(req, res));

// Mount nested deployment routes: /api/projects/:projectId/deployments
router.use("/:projectId/deployments", projectDeploymentRouter);

export default router;
