import express from "express";
import cors from "cors";
import dotenv from "dotenv";
import { prisma } from "./config/prisma";
import authRoutes from "./routes/auth.routes";
import projectRoutes from "./routes/project.routes";
import { deploymentRouter } from "./routes/deployment.routes";
import githubRoutes from "./routes/github.routes";
import webhookRoutes from "./routes/webhook.routes";
import { createLiveProxyHandler } from "./middleware/proxy.middleware";

dotenv.config();

const app = express();

const PORT = process.env.PORT || 5000;

app.use(cors());

// Clean URL reverse proxy to live deployed project ports
app.use("/live", createLiveProxyHandler);

app.use(
    express.json({
        verify: (req: any, _res, buf) => {
            req.rawBody = buf;
        },
    })
);

app.use("/api/auth", authRoutes);
app.use("/api/projects", projectRoutes);
app.use("/api/deployments", deploymentRouter);
app.use("/api/github", githubRoutes);
app.use("/api/webhooks", webhookRoutes);

app.get("/", (_req, res) => {
    res.json({
        message: "DevDeploy API is running",
    });
});

app.get("/api/health", (_req, res) => {
    res.json({
        status: "ok",
    });
});

app.get("/api/health/db", async (_req, res) => {
    try {
        await prisma.$queryRaw`SELECT 1`;
        res.json({
            status: "ok",
            database: "connected",
        });
    } catch (error) {
        res.status(500).json({
            status: "error",
            database: "disconnected",
        });
    }
});

app.listen(PORT, () => {
    console.log(`DevDeploy API running on port ${PORT}`);
});

export default app;