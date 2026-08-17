import { Request, Response, NextFunction } from "express";
import http from "http";
import { prisma } from "../config/prisma";
import { DeploymentStatus } from "@prisma/client";

/**
 * Reverse proxy middleware mounted at /live
 * Matches requests like /live/:projectRef or /live/:projectRef/subpath
 * and forwards them to the internal running port of the active deployment.
 */
export async function createLiveProxyHandler(req: Request, res: Response, next: NextFunction): Promise<void> {
    // Parse projectRef and target subpath from req.url (which is stripped of /live) or req.originalUrl
    const urlToParse = req.url.startsWith("/") ? req.url.slice(1) : req.url;
    const slashIdx = urlToParse.indexOf("/");
    const questionIdx = urlToParse.indexOf("?");

    let projectRef = "";
    let subPath = "/";

    if (slashIdx !== -1) {
        projectRef = urlToParse.substring(0, slashIdx);
        subPath = urlToParse.substring(slashIdx);
    } else if (questionIdx !== -1) {
        projectRef = urlToParse.substring(0, questionIdx);
        subPath = "/" + urlToParse.substring(questionIdx);
    } else {
        projectRef = urlToParse;
        subPath = "/";
    }

    projectRef = decodeURIComponent(projectRef.trim());

    if (!projectRef) {
        res.status(400).send("Project identifier missing from /live path");
        return;
    }

    try {
        const parsedId = parseInt(projectRef, 10);
        let projectId: number | null = null;
        let projectName: string = projectRef;

        if (!isNaN(parsedId) && parsedId > 0) {
            const project = await prisma.project.findUnique({
                where: { id: parsedId },
            });
            if (project) {
                projectId = project.id;
                projectName = project.name;
            }
        } else {
            const project = await prisma.project.findFirst({
                where: { name: { equals: projectRef, mode: "insensitive" } },
            });
            if (project) {
                projectId = project.id;
                projectName = project.name;
            }
        }

        if (!projectId) {
            res.status(404).send(`<html><body style="font-family: sans-serif; background:#09090b; color:#fafafa; display:flex; align-items:center; justify-content:center; height:100vh; margin:0;"><div style="text-align:center; padding:2rem; border:1px solid #27272a; border-radius:8px; background:#18181b;"><h2>404 - Project Not Found</h2><p style="color:#a1a1aa;">No project matches '${projectRef}'.</p></div></body></html>`);
            return;
        }

        const activeDeployment = await prisma.deployment.findFirst({
            where: {
                projectId,
                status: DeploymentStatus.SUCCESS,
            },
            orderBy: { id: "desc" },
        });

        if (!activeDeployment || !activeDeployment.runtimePort) {
            res.status(503).send(`<html><body style="font-family: sans-serif; background:#09090b; color:#fafafa; display:flex; align-items:center; justify-content:center; height:100vh; margin:0;"><div style="text-align:center; padding:2rem; border:1px solid #27272a; border-radius:8px; background:#18181b;"><h2>503 - No Active Deployment</h2><p style="color:#a1a1aa;">Project <strong>${projectName}</strong> is not currently running. Please trigger a deployment in DevDeploy.</p></div></body></html>`);
            return;
        }

        const targetPort = activeDeployment.runtimePort;

        if (!subPath.startsWith("/")) {
            subPath = "/" + subPath;
        }

        const proxyHeaders = {
            ...req.headers,
            host: `localhost:${targetPort}`,
            "x-forwarded-for": req.ip || req.socket.remoteAddress || "127.0.0.1",
            "x-forwarded-proto": req.protocol,
            "x-forwarded-host": req.headers.host || "",
        };

        const proxyReq = http.request(
            {
                hostname: "127.0.0.1",
                port: targetPort,
                path: subPath,
                method: req.method,
                headers: proxyHeaders,
                timeout: 30000,
            },
            (proxyRes) => {
                res.writeHead(proxyRes.statusCode || 200, proxyRes.headers);
                proxyRes.pipe(res, { end: true });
            }
        );

        proxyReq.on("error", (err) => {
            console.error(`[LiveProxy] Error proxying to 127.0.0.1:${targetPort}:`, err.message);
            if (!res.headersSent) {
                res.status(502).send(`<html><body style="font-family: sans-serif; background:#09090b; color:#fafafa; display:flex; align-items:center; justify-content:center; height:100vh; margin:0;"><div style="text-align:center; padding:2rem; border:1px solid #27272a; border-radius:8px; background:#18181b;"><h2>502 - Bad Gateway</h2><p style="color:#a1a1aa;">Unable to reach live process on port ${targetPort}. Ensure the deployment worker is active.</p></div></body></html>`);
            }
        });

        proxyReq.on("timeout", () => {
            proxyReq.destroy();
            if (!res.headersSent) {
                res.status(504).send("Gateway Timeout: Process took too long to respond");
            }
        });

        // Forward request body if present
        const customReq = req as any;
        if (customReq.rawBody) {
            proxyReq.write(customReq.rawBody);
            proxyReq.end();
        } else if (req.body && Object.keys(req.body).length > 0) {
            proxyReq.write(JSON.stringify(req.body));
            proxyReq.end();
        } else {
            req.pipe(proxyReq, { end: true });
        }
    } catch (error: any) {
        console.error("[LiveProxy] Unexpected proxy handler error:", error);
        next(error);
    }
}
