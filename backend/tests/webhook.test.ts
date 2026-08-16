import crypto from "crypto";
import { prisma } from "../src/config/prisma";
import { webhookService } from "../src/services/webhook.service";
import { projectService } from "../src/services/project.service";
import { DeploymentStatus } from "@prisma/client";

function generateSignature(payload: string | Buffer, secret: string): string {
    const hmac = crypto.createHmac("sha256", secret);
    hmac.update(payload);
    return `sha256=${hmac.digest("hex")}`;
}

async function runTests() {
    console.log("=== Starting DevDeploy GitHub Webhook Automated Test Suite ===\n");
    const testSecret = "test_webhook_secret_12345";
    process.env.GITHUB_WEBHOOK_SECRET = testSecret;

    let passed = 0;
    let failed = 0;

    const assert = (condition: boolean, testName: string, detail?: string) => {
        if (condition) {
            console.log(`[PASS] ${testName}`);
            passed++;
        } else {
            console.error(`[FAIL] ${testName}${detail ? ` - ${detail}` : ""}`);
            failed++;
        }
    };

    // 0. Setup test user and projects
    const testEmail = `webhook_tester_${Date.now()}@example.com`;
    const user = await prisma.user.create({
        data: {
            name: "Webhook Tester",
            email: testEmail,
            password: "hashedpassword123",
        },
    });

    const repoUrl = "https://github.com/TanviMadani/TestWebhookRepo.git";

    // Project 1: autoDeploy = true
    const projectAuto = await prisma.project.create({
        data: {
            name: "Auto Deploy Project",
            repositoryUrl: repoUrl,
            userId: user.id,
            autoDeploy: true,
        },
    });

    // Project 2: autoDeploy = false
    const projectManual = await prisma.project.create({
        data: {
            name: "Manual Deploy Project",
            repositoryUrl: "https://github.com/TanviMadani/ManualOnlyRepo.git",
            userId: user.id,
            autoDeploy: false,
        },
    });

    try {
        // --- Test Scenario A: Valid signature + correct repo + correct branch + autoDeploy=true -> 202 Queued ---
        const validPayloadA = {
            ref: "refs/heads/main",
            after: "a1b2c3d4e5f6789012345678901234567890abcd",
            repository: {
                name: "TestWebhookRepo",
                full_name: "TanviMadani/TestWebhookRepo",
                html_url: "https://github.com/TanviMadani/TestWebhookRepo",
                default_branch: "main",
                owner: { login: "TanviMadani" },
            },
            head_commit: {
                id: "a1b2c3d4e5f6789012345678901234567890abcd",
                message: "feat: add webhook integration",
            },
        };

        const rawBodyA = Buffer.from(JSON.stringify(validPayloadA));
        const sigA = generateSignature(rawBodyA, testSecret);

        const resultA = await webhookService.processGitHubWebhook({
            rawBody: rawBodyA,
            headers: {
                "x-hub-signature-256": sigA,
                "x-github-event": "push",
                "x-github-delivery": "delivery-uuid-001",
            },
            payload: validPayloadA,
        });

        assert(
            resultA.status === "queued" && resultA.statusCode === 202 && !!resultA.deploymentId,
            "Scenario A: Valid push webhook creates and queues deployment (HTTP 202)",
            `Got status: ${resultA.status}, statusCode: ${resultA.statusCode}`
        );

        if (resultA.deploymentId) {
            const depInDb = await prisma.deployment.findUnique({
                where: { id: resultA.deploymentId },
            });
            assert(
                depInDb?.status === DeploymentStatus.PENDING &&
                depInDb?.commitHash === "a1b2c3d4e5f6789012345678901234567890abcd" &&
                depInDb?.branch === "main",
                "Scenario A Check: Deployment record created in DB with PENDING status, correct commit SHA and branch"
            );
        }

        // --- Test Scenario B: Invalid signature -> 401 rejected ---
        let threwSigError = false;
        try {
            await webhookService.processGitHubWebhook({
                rawBody: rawBodyA,
                headers: {
                    "x-hub-signature-256": "sha256=invalidhexsignature000000000000000000000000000000000000000000000000",
                    "x-github-event": "push",
                    "x-github-delivery": "delivery-uuid-002",
                },
                payload: validPayloadA,
            });
        } catch (err: any) {
            if (err.statusCode === 401) {
                threwSigError = true;
            }
        }
        assert(
            threwSigError,
            "Scenario B: Invalid webhook signature returns 401 Unauthorized"
        );

        // --- Test Scenario C: autoDeploy=false -> ignored, no deployment ---
        const payloadC = {
            ref: "refs/heads/main",
            after: "c3d4e5f6789012345678901234567890abcdef12",
            repository: {
                name: "ManualOnlyRepo",
                full_name: "TanviMadani/ManualOnlyRepo",
                html_url: "https://github.com/TanviMadani/ManualOnlyRepo",
                default_branch: "main",
                owner: { login: "TanviMadani" },
            },
        };
        const rawBodyC = Buffer.from(JSON.stringify(payloadC));
        const sigC = generateSignature(rawBodyC, testSecret);

        const resultC = await webhookService.processGitHubWebhook({
            rawBody: rawBodyC,
            headers: {
                "x-hub-signature-256": sigC,
                "x-github-event": "push",
            },
            payload: payloadC,
        });

        assert(
            resultC.status === "ignored" && resultC.statusCode === 200 && !resultC.deploymentId,
            "Scenario C: Push to project with autoDeploy=false is safely ignored (HTTP 200)"
        );

        // --- Test Scenario D: Wrong branch -> ignored, no deployment ---
        const payloadD = {
            ref: "refs/heads/feature-branch",
            after: "d4e5f6789012345678901234567890abcdef1234",
            repository: {
                name: "TestWebhookRepo",
                full_name: "TanviMadani/TestWebhookRepo",
                html_url: "https://github.com/TanviMadani/TestWebhookRepo",
                default_branch: "main",
                owner: { login: "TanviMadani" },
            },
        };
        const rawBodyD = Buffer.from(JSON.stringify(payloadD));
        const sigD = generateSignature(rawBodyD, testSecret);

        const resultD = await webhookService.processGitHubWebhook({
            rawBody: rawBodyD,
            headers: {
                "x-hub-signature-256": sigD,
                "x-github-event": "push",
            },
            payload: payloadD,
        });

        assert(
            resultD.status === "ignored" && resultD.statusCode === 200 && !resultD.deploymentId,
            "Scenario D: Push to non-configured branch (feature-branch) is safely ignored (HTTP 200)"
        );

        // --- Test Scenario E: Unknown repository -> ignored, no deployment ---
        const payloadE = {
            ref: "refs/heads/main",
            after: "e5f6789012345678901234567890abcdef123456",
            repository: {
                name: "UnknownRepo",
                full_name: "TanviMadani/UnknownRepo",
                html_url: "https://github.com/TanviMadani/UnknownRepo",
                default_branch: "main",
                owner: { login: "TanviMadani" },
            },
        };
        const rawBodyE = Buffer.from(JSON.stringify(payloadE));
        const sigE = generateSignature(rawBodyE, testSecret);

        const resultE = await webhookService.processGitHubWebhook({
            rawBody: rawBodyE,
            headers: {
                "x-hub-signature-256": sigE,
                "x-github-event": "push",
            },
            payload: payloadE,
        });

        assert(
            resultE.status === "ignored" && resultE.statusCode === 200 && !resultE.deploymentId,
            "Scenario E: Push to unconfigured repository is safely ignored (HTTP 200)"
        );

        // --- Test Scenario F: Duplicate webhook / commit SHA -> idempotency check prevents duplicate deployment ---
        const resultF = await webhookService.processGitHubWebhook({
            rawBody: rawBodyA,
            headers: {
                "x-hub-signature-256": sigA,
                "x-github-event": "push",
                "x-github-delivery": "delivery-uuid-001-retry",
            },
            payload: validPayloadA,
        });

        assert(
            resultF.status === "ignored" &&
            resultF.message.includes("already exists") &&
            resultF.deploymentId === resultA.deploymentId,
            "Scenario F: Redelivered webhook for same commit returns existing deployment and skips duplicate queueing"
        );

        // --- Test Scenario G: Unsupported GitHub event (e.g. issues, ping) -> ignored ---
        const resultG = await webhookService.processGitHubWebhook({
            rawBody: rawBodyA,
            headers: {
                "x-hub-signature-256": sigA,
                "x-github-event": "issues",
            },
            payload: validPayloadA,
        });

        assert(
            resultG.status === "ignored" && resultG.statusCode === 200 && resultG.message.includes("issues"),
            "Scenario G: Unsupported GitHub event ('issues') is safely ignored (HTTP 200)"
        );

        // --- Test Scenario H: Project PATCH API updates autoDeploy setting ---
        const updatedProject = await projectService.updateProject(projectManual.id, user.id, {
            autoDeploy: true,
        });
        assert(
            updatedProject.autoDeploy === true,
            "Scenario H: Project autoDeploy field can be toggled via Project update service"
        );

        const updatedBack = await projectService.updateProject(projectManual.id, user.id, {
            autoDeploy: false,
        });
        assert(
            updatedBack.autoDeploy === false,
            "Scenario H Check 2: Project autoDeploy field can be disabled"
        );
    } finally {
        // Cleanup test data
        await prisma.deploymentLog.deleteMany({
            where: {
                deployment: {
                    projectId: { in: [projectAuto.id, projectManual.id] },
                },
            },
        });
        await prisma.deployment.deleteMany({
            where: {
                projectId: { in: [projectAuto.id, projectManual.id] },
            },
        });
        await prisma.project.deleteMany({
            where: {
                id: { in: [projectAuto.id, projectManual.id] },
            },
        });
        await prisma.user.delete({
            where: { id: user.id },
        });
        await prisma.$disconnect();
    }

    console.log(`\n=== Test Results: ${passed} passed, ${failed} failed ===`);
    if (failed > 0) {
        process.exit(1);
    } else {
        process.exit(0);
    }
}

runTests().catch(async (err) => {
    console.error("Test execution failed:", err);
    await prisma.$disconnect().catch(() => {});
    process.exit(1);
});
