import crypto from "crypto";
import { prisma } from "../config/prisma";
import { DeploymentStatus } from "@prisma/client";
import { parseGitHubUrl } from "./github.service";
import { deploymentService } from "./deployment.service";

export class WebhookError extends Error {
    statusCode: number;

    constructor(message: string, statusCode: number = 400) {
        super(message);
        this.name = "WebhookError";
        this.statusCode = statusCode;
    }
}

export interface WebhookProcessResult {
    status: "queued" | "ignored";
    statusCode: number;
    message: string;
    deploymentId?: number;
    projectId?: number;
    branch?: string;
    commitHash?: string;
}

export class WebhookService {
    /**
     * Verifies the GitHub webhook HMAC SHA-256 signature against the raw request body.
     * Uses timing-safe comparison to prevent timing attacks.
     */
    verifySignature(
        rawBody: Buffer | string | undefined,
        signatureHeader: string | undefined,
        secret?: string
    ): boolean {
        const webhookSecret = secret || process.env.GITHUB_WEBHOOK_SECRET?.trim();

        if (!webhookSecret) {
            console.error("[Webhook] Verification failed: GITHUB_WEBHOOK_SECRET is not configured on server.");
            return false;
        }

        if (!signatureHeader || typeof signatureHeader !== "string") {
            return false;
        }

        if (!signatureHeader.startsWith("sha256=")) {
            return false;
        }

        if (!rawBody) {
            return false;
        }

        try {
            const hmac = crypto.createHmac("sha256", webhookSecret);
            hmac.update(rawBody);
            const expectedSignature = `sha256=${hmac.digest("hex")}`;

            const sigBuffer = Buffer.from(signatureHeader, "utf8");
            const expectedBuffer = Buffer.from(expectedSignature, "utf8");

            if (sigBuffer.length !== expectedBuffer.length) {
                return false;
            }

            return crypto.timingSafeEqual(sigBuffer, expectedBuffer);
        } catch (error: any) {
            console.error("[Webhook] Signature verification error:", error.message || error);
            return false;
        }
    }

    /**
     * Processes an incoming GitHub webhook request.
     */
    async processGitHubWebhook(options: {
        rawBody: Buffer | string | undefined;
        headers: Record<string, string | string[] | undefined>;
        payload: any;
    }): Promise<WebhookProcessResult> {
        const { rawBody, headers, payload } = options;

        const signatureHeader = (
            headers["x-hub-signature-256"] || headers["X-Hub-Signature-256"]
        ) as string | undefined;

        const event = (
            headers["x-github-event"] || headers["X-GitHub-Event"]
        ) as string | undefined;

        const deliveryId = (
            headers["x-github-delivery"] || headers["X-GitHub-Delivery"]
        ) as string | undefined;

        // 1. Signature Security Verification
        const isValidSignature = this.verifySignature(rawBody, signatureHeader);
        if (!isValidSignature) {
            throw new WebhookError("Invalid or missing webhook signature.", 401);
        }

        // 2. Event Validation
        if (!event || event !== "push") {
            const eventName = event || "unknown";
            console.log(`[Webhook] Ignored event '${eventName}' (only 'push' is supported). Delivery: ${deliveryId || "n/a"}`);
            return {
                status: "ignored",
                statusCode: 200,
                message: `Event '${eventName}' ignored; only 'push' events are supported.`,
            };
        }

        // 3. Payload validation
        if (!payload || typeof payload !== "object") {
            throw new WebhookError("Invalid webhook payload format.", 400);
        }

        // Branch deletion check
        if (payload.deleted === true || payload.after === "0000000000000000000000000000000000000000") {
            console.log(`[Webhook] Ignored branch deletion push event. Delivery: ${deliveryId || "n/a"}`);
            return {
                status: "ignored",
                statusCode: 200,
                message: "Branch deletion event ignored.",
            };
        }

        // Ref validation (only refs/heads/ branches)
        const ref = payload.ref;
        if (!ref || typeof ref !== "string" || !ref.startsWith("refs/heads/")) {
            console.log(`[Webhook] Ignored non-branch ref '${ref || "none"}'. Delivery: ${deliveryId || "n/a"}`);
            return {
                status: "ignored",
                statusCode: 200,
                message: `Non-branch ref '${ref || "none"}' ignored.`,
            };
        }

        const pushedBranch = ref.replace(/^refs\/heads\//, "");

        // Commit SHA extraction
        const commitSha = payload.after || payload.head_commit?.id;
        if (!commitSha || typeof commitSha !== "string") {
            throw new WebhookError("Commit SHA missing from push payload.", 400);
        }

        // Repository extraction
        const repository = payload.repository;
        if (!repository || typeof repository !== "object") {
            throw new WebhookError("Repository details missing from push payload.", 400);
        }

        const repoFullName = repository.full_name || (repository.owner?.login ? `${repository.owner.login}/${repository.name}` : "");
        if (!repoFullName) {
            throw new WebhookError("Repository full name missing from push payload.", 400);
        }

        let webhookOwner: string;
        let webhookRepo: string;

        try {
            const parsed = parseGitHubUrl(
                repository.html_url || repository.clone_url || `https://github.com/${repoFullName}`
            );
            webhookOwner = parsed.owner.toLowerCase();
            webhookRepo = parsed.repo.toLowerCase();
        } catch {
            const parts = repoFullName.split("/");
            webhookOwner = parts[0]?.toLowerCase() || "";
            webhookRepo = (parts[1]?.endsWith(".git") ? parts[1].slice(0, -4) : parts[1])?.toLowerCase() || "";
        }

        if (!webhookOwner || !webhookRepo) {
            throw new WebhookError("Unable to identify repository owner and name from payload.", 400);
        }

        // 4. Project Matching
        const allProjects = await prisma.project.findMany();
        const matchingProjects = allProjects.filter((project) => {
            try {
                const { owner, repo } = parseGitHubUrl(project.repositoryUrl);
                return (
                    owner.toLowerCase() === webhookOwner &&
                    repo.toLowerCase() === webhookRepo
                );
            } catch {
                return false;
            }
        });

        if (matchingProjects.length === 0) {
            console.log(`[Webhook] No matching project found for repository '${repoFullName}'. Delivery: ${deliveryId || "n/a"}`);
            return {
                status: "ignored",
                statusCode: 200,
                message: "No matching project found for this repository.",
            };
        }

        // Evaluate matching project (or first matching project)
        const project = matchingProjects[0];

        // 5. Automatic Deployment Setting Check
        if (!project.autoDeploy) {
            console.log(`[Webhook] Auto-deploy is disabled for project '${project.name}' (ID: ${project.id}). Delivery: ${deliveryId || "n/a"}`);
            return {
                status: "ignored",
                statusCode: 200,
                message: "Automatic deployment is disabled for this project.",
                projectId: project.id,
            };
        }

        // 6. Branch Filtering
        const expectedBranch = repository.default_branch || "main";
        if (pushedBranch !== expectedBranch) {
            console.log(
                `[Webhook] Pushed branch '${pushedBranch}' does not match expected branch '${expectedBranch}' for project '${project.name}' (ID: ${project.id}). Delivery: ${deliveryId || "n/a"}`
            );
            return {
                status: "ignored",
                statusCode: 200,
                message: `Pushed branch '${pushedBranch}' does not match configured branch '${expectedBranch}'.`,
                projectId: project.id,
            };
        }

        // 7. Duplicate Webhook / Idempotency Check
        const existingDeployment = await prisma.deployment.findFirst({
            where: {
                projectId: project.id,
                commitHash: commitSha,
                status: {
                    in: [
                        DeploymentStatus.PENDING,
                        DeploymentStatus.BUILDING,
                        DeploymentStatus.RUNNING,
                        DeploymentStatus.SUCCESS,
                    ],
                },
            },
            orderBy: { createdAt: "desc" },
        });

        if (existingDeployment) {
            console.log(
                `[Webhook] Duplicate webhook or active deployment already exists for project '${project.name}' (ID: ${project.id}) with commit ${commitSha.substring(0, 7)} (deployment ID: ${existingDeployment.id}). Delivery: ${deliveryId || "n/a"}`
            );
            return {
                status: "ignored",
                statusCode: 200,
                message: "Deployment already exists for this commit.",
                deploymentId: existingDeployment.id,
                projectId: project.id,
            };
        }

        // 8. Trigger Automatic Deployment
        const deployment = await deploymentService.triggerAutoDeployment(
            project.id,
            commitSha,
            pushedBranch
        );

        console.log(
            `[Webhook] Auto-deployment ${deployment.id} created and queued for project '${project.name}' (ID: ${project.id}, branch: ${pushedBranch}, commit: ${commitSha.substring(0, 7)}). Delivery: ${deliveryId || "n/a"}`
        );

        return {
            status: "queued",
            statusCode: 202,
            message: "Deployment queued successfully",
            deploymentId: deployment.id,
            projectId: project.id,
            branch: pushedBranch,
            commitHash: commitSha,
        };
    }
}

export const webhookService = new WebhookService();
