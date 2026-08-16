import path from "path";
import fs from "fs";
import os from "os";
import { buildService } from "../src/services/build.service";
import { sanitizeLog } from "../src/services/git.service";

async function runBuildServiceTests() {
    console.log("=== Starting DevDeploy BuildService Logging & Sanitization Test Suite ===\n");

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

    // Test 1: sanitizeLog with database credentials
    const rawDbUrl = "postgresql://postgres:SecretPass123@localhost:5432/devdeploy?schema=public";
    const sanitizedDb = sanitizeLog(`Connected to ${rawDbUrl}`);
    assert(
        !sanitizedDb.includes("SecretPass123") && sanitizedDb.includes("[REDACTED]@"),
        "Scenario 1: sanitizeLog redacts database credentials in URLs"
    );

    // Test 2: sanitizeLog with JWT secrets and environment variables
    process.env.TEST_CUSTOM_SECRET = "super_secret_token_value_9988";
    const sanitizedSecret = sanitizeLog("Error with secret: super_secret_token_value_9988");
    assert(
        !sanitizedSecret.includes("super_secret_token_value_9988") && sanitizedSecret.includes("[REDACTED]"),
        "Scenario 2: sanitizeLog redacts sensitive environment secret values"
    );

    // Test 3: sanitizeLog with Bearer tokens
    const sanitizedAuth = sanitizeLog("Authorization: Bearer my_super_long_bearer_token_12345");
    assert(
        !sanitizedAuth.includes("my_super_long_bearer_token_12345") && sanitizedAuth.includes("[REDACTED]"),
        "Scenario 3: sanitizeLog redacts authorization bearer tokens"
    );

    // Create a temporary workspace for build tests
    const tempDir = path.join(os.tmpdir(), `devdeploy-test-build-${Date.now()}`);
    fs.mkdirSync(tempDir, { recursive: true });

    try {
        // Test 4: Custom build command failure exposes stdout/stderr
        const pkgJsonFail = {
            name: "test-failed-build-app",
            version: "1.0.0",
            scripts: {
                build: "exit 1",
            },
        };
        fs.writeFileSync(path.join(tempDir, "package.json"), JSON.stringify(pkgJsonFail, null, 2));

        const logs: string[] = [];
        let errorCaught: Error | null = null;

        try {
            await buildService.buildProject({
                deploymentId: 101,
                workDir: tempDir,
                buildCommand: "node -e \"console.error('Custom build error: TS2304 cannot find name Foo'); console.log('Building bundle v1...'); process.exit(1);\"",
                onLog: (msg) => {
                    logs.push(msg);
                },
            });
        } catch (err: any) {
            errorCaught = err;
        }

        assert(errorCaught !== null, "Scenario 4a: Failed custom build throws an error");
        assert(
            Boolean(errorCaught?.message.includes("[Command] Failed")),
            "Scenario 4b: Error message starts with [Command] Failed header",
            errorCaught?.message
        );
        assert(
            Boolean(errorCaught?.message.includes("Command: node -e")),
            "Scenario 4c: Error message includes command"
        );
        assert(
            Boolean(errorCaught?.message.includes("Working directory:")),
            "Scenario 4d: Error message includes working directory"
        );
        assert(
            Boolean(errorCaught?.message.includes("Exit code: 1")),
            "Scenario 4e: Error message includes exit code"
        );
        assert(
            Boolean(errorCaught?.message.includes("--- stdout ---") && errorCaught?.message.includes("Building bundle v1...")),
            "Scenario 4f: Error message includes stdout section and content"
        );
        assert(
            Boolean(errorCaught?.message.includes("--- stderr ---") && errorCaught?.message.includes("Custom build error: TS2304 cannot find name Foo")),
            "Scenario 4g: Error message includes stderr section and content"
        );
        assert(
            logs.some((l) => l.includes("[Command] Failed") && l.includes("Custom build error: TS2304 cannot find name Foo")),
            "Scenario 4h: Deployment onLog callback receives the structured command failure log"
        );

        // Test 5: Successful build continues to work normally
        const successLogs: string[] = [];
        let successError: Error | null = null;
        try {
            await buildService.buildProject({
                deploymentId: 102,
                workDir: tempDir,
                buildCommand: "node -e \"console.log('Build output: SUCCESS'); process.exit(0);\"",
                onLog: (msg) => {
                    successLogs.push(msg);
                },
            });
        } catch (err: any) {
            successError = err;
        }

        assert(successError === null, "Scenario 5a: Successful build executes without throwing");
        assert(
            successLogs.some((l) => l.includes("Application build completed successfully.")),
            "Scenario 5b: Successful build logs completion message"
        );
        // Test 6: Verify build command runs without NODE_ENV=production
        const envLogs: string[] = [];
        let envError: Error | null = null;
        try {
            await buildService.buildProject({
                deploymentId: 103,
                workDir: tempDir,
                buildCommand: "node -e \"if (process.env.NODE_ENV === 'production') process.exit(1); console.log('Env check: OK');\"",
                onLog: (msg) => {
                    envLogs.push(msg);
                },
            });
        } catch (err: any) {
            envError = err;
        }

        assert(envError === null, "Scenario 6a: Build environment does not force NODE_ENV=production");
        assert(
            envLogs.some((l) => l.includes("Env check: OK")),
            "Scenario 6b: Custom build command executes with development-ready environment"
        );

    } finally {
        fs.rmSync(tempDir, { recursive: true, force: true });
    }

    console.log(`\n=== BuildService Test Results: ${passed} passed, ${failed} failed ===\n`);
    if (failed > 0) {
        process.exit(1);
    } else {
        process.exit(0);
    }
}

runBuildServiceTests().catch((err) => {
    console.error("Test execution fatal error:", err);
    process.exit(1);
});
