import { spawn, ChildProcess } from "child_process";
import path from "path";
import fs from "fs";
import { sanitizeLog, gitService } from "./git.service";
import { portService } from "./port.service";

export interface StartApplicationOptions {
    deploymentId: number;
    projectId: number;
    workDir: string;
    port: number;
    onLog?: (message: string) => Promise<void> | void;
}

export interface RunningProcessInfo {
    deploymentId: number;
    projectId: number;
    pid: number;
    port: number;
    workDir: string;
    process: ChildProcess;
    startedAt: Date;
}

export class RuntimeService {
    // In-memory registry of active application processes
    private runningProcesses = new Map<number, RunningProcessInfo>();

    /**
     * Inspects package.json to verify and retrieve the start script command.
     */
    async getStartScript(workDir: string): Promise<string> {
        const packageJsonPath = path.join(workDir, "package.json");

        if (!fs.existsSync(packageJsonPath)) {
            throw new Error("Cannot start application: package.json not found in workspace.");
        }

        const content = await fs.promises.readFile(packageJsonPath, "utf-8");
        const parsed = JSON.parse(content);

        if (!parsed.scripts || !parsed.scripts.start || typeof parsed.scripts.start !== "string") {
            throw new Error("Cannot start application: no 'start' script defined in package.json.");
        }

        return parsed.scripts.start.trim();
    }

    /**
     * Performs retry-based HTTP health checks against the running process.
     */
    private async waitForHealthCheck(
        port: number,
        child: ChildProcess,
        timeoutMs: number = 30000,
        onLog?: (msg: string) => Promise<void> | void
    ): Promise<void> {
        const log = async (msg: string) => {
            if (onLog) await onLog(msg);
        };

        const startTime = Date.now();
        const intervalMs = 1000;
        let attempt = 0;

        await log(`Beginning runtime health checks on http://127.0.0.1:${port}...`);

        while (Date.now() - startTime < timeoutMs) {
            attempt++;

            // Fast exit if process crashed
            if (child.exitCode !== null) {
                throw new Error(`Application process terminated prematurely with exit code ${child.exitCode} during health check.`);
            }

            try {
                const controller = new AbortController();
                const timeoutId = setTimeout(() => controller.abort(), 1500);

                const response = await fetch(`http://127.0.0.1:${port}`, {
                    method: "GET",
                    signal: controller.signal,
                });

                clearTimeout(timeoutId);

                if (response.status < 600) {
                    await log(`Application health check succeeded on port ${port} (status ${response.status}).`);
                    return;
                }
            } catch {
                // Connection not ready yet, continue polling
            }

            if (attempt % 5 === 0) {
                const elapsedSec = Math.round((Date.now() - startTime) / 1000);
                await log(`Waiting for application to respond on port ${port} (${elapsedSec}s elapsed)...`);
            }

            await new Promise((resolve) => setTimeout(resolve, intervalMs));
        }

        throw new Error(`Application health check timed out after ${timeoutMs / 1000}s on port ${port}.`);
    }

    /**
     * Starts the application on the designated port, monitors stdout/stderr with rate-limiting,
     * verifies HTTP health, and registers the active process.
     */
    async startApplication(options: StartApplicationOptions): Promise<RunningProcessInfo> {
        const { deploymentId, projectId, workDir, port, onLog } = options;

        const log = async (msg: string) => {
            console.log(`[RuntimeService] [Deployment ${deploymentId}] ${msg}`);
            if (onLog) {
                await onLog(msg);
            }
        };

        // 1. Verify start script presence
        const startScript = await this.getStartScript(workDir);
        await log(`Detected start script: "${startScript}". Initializing runtime on port ${port}...`);

        // 2. Spawn child process with PORT environment variable
        const isWindows = process.platform === "win32";
        const executable = isWindows ? "npm.cmd" : "npm";

        const child = spawn(executable, ["start"], {
            cwd: workDir,
            windowsHide: true,
            shell: isWindows,
            env: {
                ...process.env,
                PORT: String(port),
                NODE_ENV: "production",
            },
        });

        if (!child.pid) {
            throw new Error("Failed to spawn application process: no PID assigned by operating system.");
        }

        const pid = child.pid;
        await log(`Application process spawned with PID ${pid} on port ${port}.`);

        // 3. Attach log listeners with throttling
        let logCountInWindow = 0;
        let lastLogReset = Date.now();

        const processLog = (data: Buffer, isErr: boolean) => {
            const now = Date.now();
            if (now - lastLogReset > 1000) {
                logCountInWindow = 0;
                lastLogReset = now;
            }

            const text = data.toString("utf-8");
            const lines = text
                .split(/\r?\n/)
                .map((l) => l.trim())
                .filter((l) => l.length > 0);

            for (const line of lines) {
                // Rate-limit runtime logs to max 15 lines per second
                if (logCountInWindow < 15) {
                    logCountInWindow++;
                    const sanitized = sanitizeLog(line);
                    if (onLog) {
                        onLog(isErr ? `[Runtime Error] ${sanitized}` : `[Runtime] ${sanitized}`);
                    }
                }
            }
        };

        child.stdout?.on("data", (data) => processLog(data, false));
        child.stderr?.on("data", (data) => processLog(data, true));

        child.on("exit", (code, signal) => {
            console.log(`[RuntimeService] Process PID ${pid} for deployment ${deploymentId} exited with code ${code}, signal ${signal}`);
            this.runningProcesses.delete(deploymentId);
            portService.releasePort(port);
            log(`Runtime process (PID: ${pid}) exited with code ${code ?? 0}${signal ? `, signal ${signal}` : ""}.`);
        });

        // 4. Perform health check verification
        try {
            await this.waitForHealthCheck(port, child, 30000, onLog);
        } catch (healthError: any) {
            // Terminate process if health check fails
            console.error(`[RuntimeService] Health check failed for deployment ${deploymentId}:`, healthError.message);
            await this.stopChildProcess(child, pid);
            portService.releasePort(port);
            throw healthError;
        }

        const processInfo: RunningProcessInfo = {
            deploymentId,
            projectId,
            pid,
            port,
            workDir,
            process: child,
            startedAt: new Date(),
        };

        this.runningProcesses.set(deploymentId, processInfo);
        await log(`Application is healthy and actively serving requests on port ${port}.`);

        return processInfo;
    }

    /**
     * Helper to forcefully kill a child process and its process tree.
     */
    private async stopChildProcess(child: ChildProcess, pid: number): Promise<void> {
        try {
            if (!child.killed) {
                if (process.platform === "win32") {
                    spawn("taskkill", ["/pid", String(pid), "/T", "/F"], { windowsHide: true });
                } else {
                    child.kill("SIGTERM");
                }
            }
        } catch (err: any) {
            console.error(`[RuntimeService] Error stopping child PID ${pid}:`, err.message);
        }
    }

    /**
     * Stops the running process for a specific deployment, releases its port, and cleans up its workspace.
     */
    async stopDeploymentProcess(deploymentId: number): Promise<void> {
        const info = this.runningProcesses.get(deploymentId);
        if (!info) return;

        console.log(`[RuntimeService] Stopping process PID ${info.pid} (port ${info.port}) for deployment ${deploymentId}...`);

        try {
            await this.stopChildProcess(info.process, info.pid);
        } finally {
            this.runningProcesses.delete(deploymentId);
            portService.releasePort(info.port);

            if (info.workDir) {
                await gitService.cleanupWorkingDirectory(info.workDir);
            }
        }
    }

    /**
     * Stops any previous deployments for the specified project (used in zero-downtime transitions).
     */
    async stopPreviousProjectDeployments(projectId: number, currentDeploymentId: number): Promise<void> {
        for (const [depId, info] of this.runningProcesses.entries()) {
            if (info.projectId === projectId && depId !== currentDeploymentId) {
                console.log(`[RuntimeService] Retiring previous deployment ${depId} for project ${projectId}...`);
                await this.stopDeploymentProcess(depId);
            }
        }
    }

    /**
     * Retrieves active running process metadata for a deployment.
     */
    getRunningProcess(deploymentId: number): RunningProcessInfo | undefined {
        return this.runningProcesses.get(deploymentId);
    }

    /**
     * Retrieves all currently active running processes.
     */
    getAllRunningProcesses(): RunningProcessInfo[] {
        return Array.from(this.runningProcesses.values());
    }

    /**
     * Gracefully terminates all running processes (used during worker shutdown).
     */
    async stopAllProcesses(): Promise<void> {
        console.log(`[RuntimeService] Stopping all ${this.runningProcesses.size} active deployment processes...`);
        const deploymentIds = Array.from(this.runningProcesses.keys());
        for (const id of deploymentIds) {
            await this.stopDeploymentProcess(id);
        }
    }
}

export const runtimeService = new RuntimeService();
