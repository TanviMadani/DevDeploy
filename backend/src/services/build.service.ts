import { spawn } from "child_process";
import path from "path";
import fs from "fs";
import { sanitizeLog } from "./git.service";

export interface BuildOptions {
    deploymentId: number;
    workDir: string;
    onLog?: (message: string) => Promise<void> | void;
}

export class BuildService {
    /**
     * Executes a process and streams stdout/stderr lines to the logger callback.
     */
    private runCommand(
        command: string,
        args: string[],
        cwd: string,
        onLog?: (message: string) => Promise<void> | void,
        timeoutMs: number = 300000 // 5 minutes default timeout
    ): Promise<{ stdout: string; stderr: string; exitCode: number }> {
        return new Promise((resolve, reject) => {
            const isWindows = process.platform === "win32";
            const executable = isWindows && !command.endsWith(".cmd") && !command.endsWith(".exe")
                ? `${command}.cmd`
                : command;

            console.log(`[BuildService] Executing: ${executable} ${args.join(" ")} in ${cwd}`);

            let stdout = "";
            let stderr = "";
            let timeoutHandle: NodeJS.Timeout | null = null;

            const child = spawn(executable, args, {
                cwd,
                windowsHide: true,
                shell: isWindows,
                env: {
                    ...process.env,
                    CI: "true",
                    NODE_ENV: "production",
                },
            });

            if (timeoutMs > 0) {
                timeoutHandle = setTimeout(() => {
                    child.kill("SIGTERM");
                    reject(new Error(`Command '${command} ${args.join(" ")}' timed out after ${timeoutMs / 1000}s`));
                }, timeoutMs);
            }

            const processOutput = (data: Buffer, isError: boolean) => {
                const text = data.toString("utf-8");
                if (isError) {
                    stderr += text;
                } else {
                    stdout += text;
                }

                // Process output lines and emit progress logs
                const lines = text
                    .split(/\r?\n/)
                    .map((l) => l.trim())
                    .filter((l) => l.length > 0);

                for (const line of lines) {
                    const sanitized = sanitizeLog(line);
                    if (onLog) {
                        onLog(sanitized);
                    }
                }
            };

            child.stdout?.on("data", (data) => processOutput(data, false));
            child.stderr?.on("data", (data) => processOutput(data, true));

            child.on("error", (err) => {
                if (timeoutHandle) clearTimeout(timeoutHandle);
                reject(err);
            });

            child.on("close", (code) => {
                if (timeoutHandle) clearTimeout(timeoutHandle);
                const exitCode = code ?? 0;
                resolve({ stdout, stderr, exitCode });
            });
        });
    }

    /**
     * Inspects the project in workDir, installs dependencies, and runs the build script.
     */
    async buildProject(options: BuildOptions): Promise<void> {
        const { deploymentId, workDir, onLog } = options;

        const log = async (msg: string) => {
            console.log(`[BuildService] [Deployment ${deploymentId}] ${msg}`);
            if (onLog) {
                await onLog(msg);
            }
        };

        const packageJsonPath = path.join(workDir, "package.json");

        if (!fs.existsSync(packageJsonPath)) {
            const msg = "Project inspection failed: no package.json found in repository root.";
            await log(msg);
            throw new Error(msg);
        }

        let packageJson: any;
        try {
            const rawContent = await fs.promises.readFile(packageJsonPath, "utf-8");
            packageJson = JSON.parse(rawContent);
            await log(`Inspected project: '${packageJson.name || "unnamed"}' (${packageJson.version || "1.0.0"})`);
        } catch (err: any) {
            const msg = `Failed to parse package.json: ${err.message}`;
            await log(msg);
            throw new Error(msg);
        }

        // Determine package manager command (npm ci vs npm install)
        const packageLockPath = path.join(workDir, "package-lock.json");
        const hasLockFile = fs.existsSync(packageLockPath);

        const installArgs = hasLockFile ? ["ci"] : ["install"];
        const installCmdName = hasLockFile ? "npm ci" : "npm install";

        await log(`Installing dependencies using '${installCmdName}'...`);

        try {
            const installResult = await this.runCommand("npm", installArgs, workDir, onLog);

            if (installResult.exitCode !== 0) {
                const failMsg = `Dependency installation failed (${installCmdName} exited with code ${installResult.exitCode}).`;
                await log(failMsg);
                throw new Error(failMsg);
            }

            await log("Dependencies installed successfully.");
        } catch (error: any) {
            const sanitized = sanitizeLog(error.message || "Dependency installation failed");
            throw new Error(sanitized);
        }

        // Execute application build step
        const hasBuildScript = Boolean(packageJson.scripts && packageJson.scripts.build);

        if (!hasBuildScript) {
            await log("No 'build' script specified in package.json. Skipping build step.");
            await log("Application build completed successfully.");
            return;
        }

        await log("Running build script: 'npm run build'...");

        try {
            const buildResult = await this.runCommand("npm", ["run", "build"], workDir, onLog);

            if (buildResult.exitCode !== 0) {
                const failMsg = `Application build failed ('npm run build' exited with code ${buildResult.exitCode}).`;
                await log(failMsg);
                throw new Error(failMsg);
            }

            await log("Application build completed successfully.");
        } catch (error: any) {
            const sanitized = sanitizeLog(error.message || "Application build failed");
            throw new Error(sanitized);
        }
    }
}

export const buildService = new BuildService();
