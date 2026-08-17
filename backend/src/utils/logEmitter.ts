import { EventEmitter } from "events";

class LogEventEmitter extends EventEmitter {
    constructor() {
        super();
        this.setMaxListeners(200);
    }

    emitLog(deploymentId: number, message: string, timestamp: Date = new Date()) {
        this.emit(`log:${deploymentId}`, {
            deploymentId,
            message,
            timestamp: timestamp.toISOString(),
        });
    }

    emitStatus(deploymentId: number, status: string) {
        this.emit(`status:${deploymentId}`, {
            deploymentId,
            status,
        });
    }

    subscribe(deploymentId: number, listener: (data: { deploymentId: number; message: string; timestamp: string }) => void) {
        const eventName = `log:${deploymentId}`;
        this.on(eventName, listener);
        return () => {
            this.off(eventName, listener);
        };
    }
}

export const logEmitter = new LogEventEmitter();
