import { Router } from "express";
import { deploymentController } from "../controllers/deployment.controller";
import { authenticateToken } from "../middleware/auth.middleware";

// Router for nested project deployments: /api/projects/:projectId/deployments
export const projectDeploymentRouter = Router({ mergeParams: true });
projectDeploymentRouter.use(authenticateToken);

projectDeploymentRouter.get("/latest", (req, res) => deploymentController.getLatestDeployment(req, res));
projectDeploymentRouter.get("/", (req, res) => deploymentController.getProjectDeployments(req, res));
projectDeploymentRouter.post("/", (req, res) => deploymentController.createDeployment(req, res));

// Router for direct deployment resources: /api/deployments/:id
export const deploymentRouter = Router();
deploymentRouter.use(authenticateToken);

deploymentRouter.get("/:id", (req, res) => deploymentController.getDeploymentById(req, res));
deploymentRouter.get("/:id/status", (req, res) => deploymentController.getDeploymentStatus(req, res));
deploymentRouter.get("/:id/logs", (req, res) => deploymentController.getDeploymentLogs(req, res));
deploymentRouter.patch("/:id/status", (req, res) => deploymentController.updateDeploymentStatus(req, res));
deploymentRouter.post("/:id/stop", (req, res) => deploymentController.stopDeployment(req, res));

export default deploymentRouter;

