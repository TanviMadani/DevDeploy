import { spawn } from "child_process";
import path from "path";
import fs from "fs";
import { sanitizeLog } from "./git.service";

export interface BuildOptions {
    deploymentId: number;
    workDir: string;
    buildCommand?: string | null;
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
     * Executes a raw shell command string and streams stdout/stderr lines to the logger callback.
     */
    private runShellCommand(
        commandLine: string,
        cwd: string,
        onLog?: (message: string) => Promise<void> | void,
        timeoutMs: number = 300000 // 5 minutes default timeout
    ): Promise<{ stdout: string; stderr: string; exitCode: number }> {
        return new Promise((resolve, reject) => {
            console.log(`[BuildService] Executing shell command: "${commandLine}" in ${cwd}`);

            let stdout = "";
            let stderr = "";
            let timeoutHandle: NodeJS.Timeout | null = null;

            const child = spawn(commandLine, {
                cwd,
                windowsHide: true,
                shell: true,
                env: {
                    ...process.env,
                    CI: "true",
                    NODE_ENV: "production",
                },
            });

            if (timeoutMs > 0) {
                timeoutHandle = setTimeout(() => {
                    child.kill("SIGTERM");
                    reject(new Error(`Command '${commandLine}' timed out after ${timeoutMs / 1000}s`));
                }, timeoutMs);
            }

            const processOutput = (data: Buffer, isError: boolean) => {
                const text = data.toString("utf-8");
                if (isError) {
                    stderr += text;
                } else {
                    stdout += text;
                }

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
     * Formats a failed command execution log including command, working directory, exit code, stdout, and stderr.
     * Sanitizes output to ensure no secrets or credentials are leaked.
     */
    private formatFailedCommandLog(
        command: string,
        cwd: string,
        exitCode: number,
        stdout: string,
        stderr: string
    ): string {
        const sanitizedStdout = sanitizeLog(stdout?.trim() || "");
        const sanitizedStderr = sanitizeLog(stderr?.trim() || "");

        return [
            "[Command] Failed",
            `Command: ${command}`,
            `Working directory: ${cwd}`,
            `Exit code: ${exitCode}`,
            "--- stdout ---",
            sanitizedStdout,
            "--- stderr ---",
            sanitizedStderr,
        ].join("\n");
    }

    /**
     * Inspects the project in workDir, installs dependencies, and runs the build script.
     */
    async buildProject(options: BuildOptions): Promise<void> {
        const { deploymentId, workDir, buildCommand, onLog } = options;

        const log = async (msg: string) => {
            console.log(`[BuildService] [Deployment ${deploymentId}] ${msg}`);
            if (onLog) {
                await onLog(msg);
            }
        };

        const packageJsonPath = path.join(workDir, "package.json");

        if (!fs.existsSync(packageJsonPath)) {
            const msg = "Project inspection failed: no package.json found in workspace directory.";
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
                const failedLog = this.formatFailedCommandLog(
                    installCmdName,
                    workDir,
                    installResult.exitCode,
                    installResult.stdout,
                    installResult.stderr
                );
                console.error(`[BuildService] [Deployment ${deploymentId}]\n${failedLog}`);

                if (onLog) {
                    await onLog(failedLog);
                }
                throw new Error(failedLog);
            }

            await log("Dependencies installed successfully.");
        } catch (error: any) {
            if (error.stdout || error.stderr) {
                const failedLog = this.formatFailedCommandLog(
                    installCmdName,
                    workDir,
                    error.status || error.code || 1,
                    error.stdout || "",
                    error.stderr || ""
                );
                console.error(`[BuildService] [Deployment ${deploymentId}]\n${failedLog}`);
                if (onLog) {
                    await onLog(failedLog);
                }
                throw new Error(failedLog);
            }
            const sanitized = sanitizeLog(error.message || "Dependency installation failed");
            throw new Error(sanitized);
        }

        // Execute application build step
        const customBuild = buildCommand?.trim();

        if (customBuild && customBuild.length > 0) {
            await log(`Running custom build command: '${customBuild}'...`);

            try {
                const buildResult = await this.runShellCommand(customBuild, workDir, onLog);

                if (buildResult.exitCode !== 0) {
                    const failedLog = this.formatFailedCommandLog(
                        customBuild,
                        workDir,
                        buildResult.exitCode,
                        buildResult.stdout,
                        buildResult.stderr
                    );
                    console.error(`[BuildService] [Deployment ${deploymentId}]\n${failedLog}`);

                    if (onLog) {
                        await onLog(failedLog);
                    }
                    throw new Error(failedLog);
                }

                await log("Application build completed successfully.");
            } catch (error: any) {
                if (error.stdout || error.stderr) {
                    const failedLog = this.formatFailedCommandLog(
                        customBuild,
                        workDir,
                        error.status || error.code || 1,
                        error.stdout || "",
                        error.stderr || ""
                    );
                    console.error(`[BuildService] [Deployment ${deploymentId}]\n${failedLog}`);
                    if (onLog) {
                        await onLog(failedLog);
                    }
                    throw new Error(failedLog);
                }
                const sanitized = sanitizeLog(error.message || "Application build failed");
                throw new Error(sanitized);
            }
        } else {
            // Fallback: Check package.json scripts.build
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
                    const failedLog = this.formatFailedCommandLog(
                        "npm run build",
                        workDir,
                        buildResult.exitCode,
                        buildResult.stdout,
                        buildResult.stderr
                    );
                    console.error(`[BuildService] [Deployment ${deploymentId}]\n${failedLog}`);

                    if (onLog) {
                        await onLog(failedLog);
                    }
                    throw new Error(failedLog);
                }

                await log("Application build completed successfully.");
            } catch (error: any) {
                if (error.stdout || error.stderr) {
                    const failedLog = this.formatFailedCommandLog(
                        "npm run build",
                        workDir,
                        error.status || error.code || 1,
                        error.stdout || "",
                        error.stderr || ""
                    );
                    console.error(`[BuildService] [Deployment ${deploymentId}]\n${failedLog}`);
                    if (onLog) {
                        await onLog(failedLog);
                    }
                    throw new Error(failedLog);
                }
                const sanitized = sanitizeLog(error.message || "Application build failed");
                throw new Error(sanitized);
            }
        }
    }
}

export const buildService = new BuildService();
