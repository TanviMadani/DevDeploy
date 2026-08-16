import { prisma } from "../src/config/prisma";
import { projectService } from "../src/services/project.service";
import { resolveDeploymentDirectory } from "../src/workers/deployment.worker";
import { runtimeService } from "../src/services/runtime.service";
import path from "path";
import fs from "fs";
import os from "os";

async function runProjectConfigTests() {
    console.log("=== Starting DevDeploy Project Configuration Automated Test Suite ===\n");

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

    const testEmail = `proj_tester_${Date.now()}@example.com`;
    const user = await prisma.user.create({
        data: {
            name: "Project Config Tester",
            email: testEmail,
            password: "hashedpassword123",
        },
    });

    try {
        // --- Test Scenario 1: Create Project with buildCommand, startCommand, rootDirectory ---
        const project = await projectService.createProject({
            name: "Full Stack Monorepo",
            description: "DevDeploy monorepo with backend root directory",
            repositoryUrl: "https://github.com/TanviMadani/DevDeploy",
            userId: user.id,
            autoDeploy: true,
            buildCommand: "npm run build:custom",
            startCommand: "node dist/server.js",
            rootDirectory: "backend",
        });

        assert(
            project.buildCommand === "npm run build:custom" &&
            project.startCommand === "node dist/server.js" &&
            project.rootDirectory === "backend" &&
            project.autoDeploy === true,
            "Scenario 1: Project created with buildCommand, startCommand, and rootDirectory"
        );

        // --- Test Scenario 2: Update Project fields via updateProject ---
        const updated = await projectService.updateProject(project.id, user.id, {
            buildCommand: "npm run compile",
            startCommand: "npm run start:prod",
            rootDirectory: "src/server",
        });

        assert(
            updated.buildCommand === "npm run compile" &&
            updated.startCommand === "npm run start:prod" &&
            updated.rootDirectory === "src/server",
            "Scenario 2: Project updated with new buildCommand, startCommand, and rootDirectory"
        );

        // --- Test Scenario 3: Clear optional fields to null ---
        const cleared = await projectService.updateProject(project.id, user.id, {
            buildCommand: null,
            startCommand: null,
            rootDirectory: null,
        });

        assert(
            cleared.buildCommand === null &&
            cleared.startCommand === null &&
            cleared.rootDirectory === null,
            "Scenario 3: Project fields can be cleared to null"
        );

        // --- Test Scenario 4: Directory Resolution - Normal subdirectory ---
        const tempRoot = fs.mkdtempSync(path.join(os.tmpdir(), "devdeploy-test-"));
        const subDir = path.join(tempRoot, "backend");
        fs.mkdirSync(subDir, { recursive: true });

        const resolved = resolveDeploymentDirectory(tempRoot, "backend");
        assert(
            resolved === path.resolve(subDir),
            "Scenario 4: resolveDeploymentDirectory resolves valid subdirectory"
        );

        const defaultResolved = resolveDeploymentDirectory(tempRoot, null);
        assert(
            defaultResolved === tempRoot,
            "Scenario 4b: resolveDeploymentDirectory returns repo root when rootDirectory is null"
        );

        // --- Test Scenario 5: Path Traversal Security Check ---
        let traversalCaught = false;
        try {
            resolveDeploymentDirectory(tempRoot, "../../etc/passwd");
        } catch (err: any) {
            traversalCaught = err.message.includes("directory traversal");
        }
        assert(traversalCaught, "Scenario 5: resolveDeploymentDirectory prevents path traversal (../../)");

        // --- Test Scenario 6: Non-existent directory rejection ---
        let notFoundCaught = false;
        try {
            resolveDeploymentDirectory(tempRoot, "non_existent_folder");
        } catch (err: any) {
            notFoundCaught = err.message.includes("does not exist");
        }
        assert(notFoundCaught, "Scenario 6: resolveDeploymentDirectory throws for non-existent rootDirectory");

        // --- Test Scenario 7: Runtime start script inspection failure when neither exists ---
        const emptyAppDir = fs.mkdtempSync(path.join(os.tmpdir(), "devdeploy-empty-app-"));
        fs.writeFileSync(
            path.join(emptyAppDir, "package.json"),
            JSON.stringify({ name: "no-start-app", scripts: { test: "echo 1" } })
        );

        const startScript = await runtimeService.getStartScript(emptyAppDir);
        assert(
            startScript === null,
            "Scenario 7: getStartScript returns null when package.json lacks 'start' script"
        );

        let explicitFail = false;
        try {
            await runtimeService.startApplication({
                deploymentId: 99999,
                projectId: project.id,
                workDir: emptyAppDir,
                port: 59999,
                startCommand: null,
            });
        } catch (err: any) {
            explicitFail = err.message.includes("no startCommand configured on project and no 'start' script found");
        }
        assert(
            explicitFail,
            "Scenario 7b: startApplication fails explicitly when no startCommand and no start script exist"
        );

        // Cleanup temporary test directories
        fs.rmSync(tempRoot, { recursive: true, force: true });
        fs.rmSync(emptyAppDir, { recursive: true, force: true });
    } finally {
        await prisma.project.deleteMany({
            where: { userId: user.id },
        });
        await prisma.$disconnect();
    }

    console.log(`\n=== Test Results: ${passed} passed, ${failed} failed ===\n`);
    if (failed > 0) {
        process.exit(1);
    } else {
        process.exit(0);
    }
}

runProjectConfigTests().catch(async (err) => {
    console.error("Test runner encountered an unhandled error:", err);
    await prisma.$disconnect().catch(() => {});
    process.exit(1);
});
