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
 * Strips sensitive tokens and credentials from logs or error messages.
 */
export function sanitizeLog(text: string): string {
    if (!text || typeof text !== "string") return text;

    const token = process.env.GITHUB_TOKEN?.trim();
    let sanitized = text;

    if (token && token.length > 0) {
        sanitized = sanitized.split(token).join("[REDACTED]");
    }

    // Also strip generic basic auth formats in URLs (e.g. https://user:pass@...)
    sanitized = sanitized.replace(/(https?:\/\/)[^/@\s]+@/g, "$1[REDACTED]@");

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
