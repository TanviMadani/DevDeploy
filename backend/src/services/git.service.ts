import { execFile } from "child_process";
import util from "util";
import path from "path";
import os from "os";
import fs from "fs";
import { parseGitHubUrl } from "./github.service";

const execFileAsync = util.promisify(execFile);

export interface CheckoutOptions {
    deploymentId: number;
    repositoryUrl: string;
    commitHash?: string | null;
    branch?: string | null;
    onLog?: (message: string) => Promise<void> | void;
}

export interface CheckoutResult {
    workDir: string;
    commitHash?: string | null;
    branch?: string | null;
}

/**
 * Strips sensitive tokens, credentials, and environment secrets from logs or error messages.
 */
export function sanitizeLog(text: string): string {
    if (!text || typeof text !== "string") return text;

    let sanitized = text;

    // 1. Redact credentials in connection URLs (e.g. postgresql://user:pass@host, redis://:pass@host, http://user:pass@host)
    sanitized = sanitized.replace(/([a-zA-Z0-9+.-]+:\/\/)[^/@\s]+@/g, "$1[REDACTED]@");

    // 2. Redact sensitive values from environment variables
    const sensitiveKeyPatterns = [
        "SECRET",
        "TOKEN",
        "PASSWORD",
        "PASSWD",
        "AUTH",
        "CREDENTIAL",
        "PRIVATE_KEY",
        "API_KEY",
        "APIKEY",
        "DATABASE_URL",
        "REDIS_URL",
    ];

    for (const key of Object.keys(process.env)) {
        const upper = key.toUpperCase();
        const isSensitive = sensitiveKeyPatterns.some((pattern) => upper.includes(pattern));

        if (isSensitive) {
            const rawVal = process.env[key]?.trim();
            if (rawVal && rawVal.length >= 6) {
                // If it's a URL like postgresql://user:pass@host, extract password part
                const urlMatch = rawVal.match(/^[a-zA-Z0-9+.-]+:\/\/([^/@\s]+)@/);
                if (urlMatch && urlMatch[1]) {
                    const creds = urlMatch[1];
                    const colonIndex = creds.indexOf(":");
                    if (colonIndex !== -1) {
                        const pass = creds.substring(colonIndex + 1);
                        if (pass.length >= 4) {
                            sanitized = sanitized.split(pass).join("[REDACTED]");
                            try {
                                const decodedPass = decodeURIComponent(pass);
                                if (decodedPass !== pass && decodedPass.length >= 4) {
                                    sanitized = sanitized.split(decodedPass).join("[REDACTED]");
                                }
                            } catch {
                                // Ignore decode error
                            }
                        }
                    }
                }

                // Redact the raw value itself
                sanitized = sanitized.split(rawVal).join("[REDACTED]");

                // Redact decoded/encoded variations if applicable
                try {
                    const decoded = decodeURIComponent(rawVal);
                    if (decoded !== rawVal && decoded.length >= 6) {
                        sanitized = sanitized.split(decoded).join("[REDACTED]");
                    }
                } catch {
                    // Ignore decode error
                }
            }
        }
    }

    // 3. Redact Authorization headers or Bearer tokens in text
    sanitized = sanitized.replace(/(Authorization:\s*(?:Bearer|Basic|Token)\s+)[^\r\n\s]+/gi, "$1[REDACTED]");
    sanitized = sanitized.replace(/((?:bearer|token)\s+)[a-zA-Z0-9_.~+\/=-]{16,}/gi, "$1[REDACTED]");

    return sanitized;
}

export class GitService {
    /**
     * Clones a repository into a temporary directory and checks out the designated commit or branch.
     */
    async checkoutRepository(options: CheckoutOptions): Promise<CheckoutResult> {
        const { deploymentId, repositoryUrl, commitHash, branch, onLog } = options;

        const log = async (msg: string) => {
            if (onLog) {
                await onLog(msg);
            }
        };

        const { owner, repo } = parseGitHubUrl(repositoryUrl);

        // Generate temporary workspace path
        const uniqueSuffix = `${Date.now()}-${Math.random().toString(36).substring(2, 8)}`;
        const workDir = path.join(
            os.tmpdir(),
            "devdeploy-workspaces",
            `deployment-${deploymentId}-${uniqueSuffix}`
        );

        await fs.promises.mkdir(workDir, { recursive: true });

        // Construct clone URL (inject token for authenticated clone if present)
        const token = process.env.GITHUB_TOKEN?.trim();
        const cloneUrl = token
            ? `https://${encodeURIComponent(token)}@github.com/${encodeURIComponent(owner)}/${encodeURIComponent(repo)}.git`
            : `https://github.com/${encodeURIComponent(owner)}/${encodeURIComponent(repo)}.git`;

        try {
            await log(`Cloning repository '${owner}/${repo}' into workspace...`);
            console.log(`[GitService] Cloning '${owner}/${repo}' for deployment ${deploymentId} into ${workDir}`);

            const gitEnv = {
                ...process.env,
                GIT_TERMINAL_PROMPT: "0",
                GCM_INTERACTIVE: "0",
            };

            // Clone the repository
            await execFileAsync("git", ["clone", cloneUrl, workDir], {
                windowsHide: true,
                maxBuffer: 10 * 1024 * 1024,
                timeout: 60000,
                env: gitEnv,
            });

            // Checkout commitHash or branch
            const targetRef = commitHash?.trim() || branch?.trim();
            if (targetRef) {
                await log(`Checking out reference '${targetRef}'...`);
                console.log(`[GitService] Checking out '${targetRef}' in ${workDir}`);

                await execFileAsync("git", ["checkout", targetRef], {
                    cwd: workDir,
                    windowsHide: true,
                    maxBuffer: 10 * 1024 * 1024,
                    timeout: 30000,
                    env: gitEnv,
                });

                await log(`Successfully checked out reference '${targetRef}'.`);
            } else {
                await log("Repository cloned using default branch.");
            }

            return {
                workDir,
                commitHash,
                branch,
            };
        } catch (error: any) {
            const rawMessage = error.message || error.stderr || "Git checkout failed";
            const sanitizedMessage = sanitizeLog(rawMessage);
            console.error(`[GitService] Checkout failed for deployment ${deploymentId}:`, sanitizedMessage);
            throw new Error(sanitizedMessage);
        }
    }

    /**
     * Safely removes the temporary working directory with retry logic for releasing file locks.
     */
    async cleanupWorkingDirectory(workDir: string, retries: number = 3): Promise<void> {
        if (!workDir || typeof workDir !== "string") return;

        for (let attempt = 1; attempt <= retries; attempt++) {
            try {
                if (fs.existsSync(workDir)) {
                    await fs.promises.rm(workDir, { recursive: true, force: true });
                    console.log(`[GitService] Cleaned up temporary workspace: ${workDir}`);
                }
                return;
            } catch (err: any) {
                if (attempt < retries) {
                    await new Promise((resolve) => setTimeout(resolve, 500));
                } else {
                    console.error(`[GitService] Failed to remove workspace ${workDir}:`, err.message);
                }
            }
        }
    }
}

export const gitService = new GitService();
