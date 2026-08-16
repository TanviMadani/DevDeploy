import net from "net";

export class PortService {
    private allocatedPorts = new Set<number>();
    private minPort: number;
    private maxPort: number;

    constructor(minPort = 4000, maxPort = 4999) {
        this.minPort = minPort;
        this.maxPort = maxPort;
    }

    /**
     * Checks whether a TCP port is physically unbound on the host machine.
     */
    private isPortAvailable(port: number): Promise<boolean> {
        return new Promise((resolve) => {
            const server = net.createServer();
            server.unref();

            server.once("error", () => {
                resolve(false);
            });

            server.listen(port, "0.0.0.0", () => {
                server.close(() => {
                    resolve(true);
                });
            });
        });
    }

    /**
     * Safely finds, reserves, and returns an available local TCP port.
     */
    async allocatePort(): Promise<number> {
        for (let port = this.minPort; port <= this.maxPort; port++) {
            if (this.allocatedPorts.has(port)) {
                continue;
            }

            const free = await this.isPortAvailable(port);
            if (free) {
                this.allocatedPorts.add(port);
                console.log(`[PortService] Reserved port ${port}`);
                return port;
            }
        }

        throw new Error(`[PortService] No available ports in designated range ${this.minPort}-${this.maxPort}`);
    }

    /**
     * Releases a previously reserved port back into the allocation pool.
     */
    releasePort(port: number): void {
        if (this.allocatedPorts.has(port)) {
            this.allocatedPorts.delete(port);
            console.log(`[PortService] Released port ${port}`);
        }
    }

    /**
     * Returns an array of currently allocated ports.
     */
    getAllocatedPorts(): number[] {
        return Array.from(this.allocatedPorts);
    }
}

export const portService = new PortService();
