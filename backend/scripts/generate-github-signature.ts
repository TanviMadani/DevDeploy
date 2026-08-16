import fs from "fs";
import path from "path";
import crypto from "crypto";
import dotenv from "dotenv";

// Load environment variables from .env
dotenv.config();

/**
 * Generates an HMAC-SHA256 signature for a GitHub webhook JSON payload
 * for local testing in Postman or cURL without weakening server-side security.
 *
 * Usage:
 *   npx tsx scripts/generate-github-signature.ts [optional-path-to-json-file]
 *   npm run webhook:signature
 */
function main() {
    const secret = process.env.GITHUB_WEBHOOK_SECRET?.trim();

    if (!secret) {
        console.error("Error: GITHUB_WEBHOOK_SECRET is not configured in your environment or .env file.");
        console.error("Please set GITHUB_WEBHOOK_SECRET in backend/.env before running this script.");
        process.exit(1);
    }

    // Default to sample-push-payload.json if no argument provided
    const targetFilePath = process.argv[2]
        ? path.resolve(process.cwd(), process.argv[2])
        : path.join(__dirname, "sample-push-payload.json");

    if (!fs.existsSync(targetFilePath)) {
        console.error(`Error: Payload file not found at "${targetFilePath}".`);
        console.error("Please specify a valid JSON payload file path or ensure scripts/sample-push-payload.json exists.");
        process.exit(1);
    }

    // Read exact raw bytes of payload file
    const rawBuffer = fs.readFileSync(targetFilePath);
    const rawPayloadString = rawBuffer.toString("utf8");

    // Validate that it is valid JSON
    try {
        JSON.parse(rawPayloadString);
    } catch (parseError: any) {
        console.error(`Error: "${targetFilePath}" does not contain valid JSON:`, parseError.message);
        process.exit(1);
    }

    // Calculate HMAC-SHA256 over exact raw bytes
    const hmac = crypto.createHmac("sha256", secret);
    hmac.update(rawBuffer);
    const signature = `sha256=${hmac.digest("hex")}`;

    console.log("\n========================================================");
    console.log("  DevDeploy GitHub Webhook Signature & Postman Helper   ");
    console.log("========================================================\n");
    console.log(`Payload File:        ${path.relative(process.cwd(), targetFilePath)}`);
    console.log(`Target Endpoint:     POST http://localhost:5000/api/webhooks/github`);
    console.log(`X-GitHub-Event:      push`);
    console.log(`X-Hub-Signature-256: ${signature}\n`);
    console.log("--------------------------------------------------------");
    console.log("Postman Setup Instructions:");
    console.log("1. Method: POST");
    console.log("2. URL: http://localhost:5000/api/webhooks/github");
    console.log("3. Headers:");
    console.log("   - Content-Type: application/json");
    console.log("   - X-GitHub-Event: push");
    console.log(`   - X-Hub-Signature-256: ${signature}`);
    console.log("4. Body -> raw -> JSON:");
    console.log("   Copy and paste the exact contents of the payload file:");
    console.log("--------------------------------------------------------\n");
    console.log(rawPayloadString.trim());
    console.log("\n--------------------------------------------------------");
    console.log("Quick cURL Command:");
    console.log("--------------------------------------------------------");
    // Escape single quotes for cURL if running on POSIX/Git Bash
    const sanitizedBody = rawPayloadString.replace(/'/g, "'\\''");
    console.log(`curl -X POST http://localhost:5000/api/webhooks/github \\
  -H "Content-Type: application/json" \\
  -H "X-GitHub-Event: push" \\
  -H "X-Hub-Signature-256: ${signature}" \\
  -d '${sanitizedBody.trim()}'
`);
}

main();
