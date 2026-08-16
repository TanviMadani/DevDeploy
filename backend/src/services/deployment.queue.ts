import { Queue } from "bullmq";
import { redisConnection } from "../config/redis";

export interface DeploymentJobData {
    deploymentId: number;
}

/**
 * BullMQ Queue for handling asynchronous deployment jobs.
 */
export const deploymentQueue = new Queue<DeploymentJobData>("deployment", {
    connection: redisConnection,
    defaultJobOptions: {
        attempts: 3,
        backoff: {
            type: "exponential",
            delay: 2000,
        },
        removeOnComplete: true,
        removeOnFail: false,
    },
});

/**
 * Adds a deployment job to the BullMQ deployment queue.
 * @param deploymentId - ID of the deployment to process
 */
export async function queueDeployment(deploymentId: number): Promise<void> {
    if (!deploymentId || typeof deploymentId !== "number" || isNaN(deploymentId)) {
        throw new Error("Invalid deployment ID provided for queuing.");
    }

    try {
        await deploymentQueue.add(
            "deployment",
            { deploymentId },
            {
                jobId: `deployment-${deploymentId}`,
            }
        );
        console.log(`[Queue] Enqueued deployment job for ID: ${deploymentId}`);
    } catch (error: any) {
        console.error(`[Queue] Failed to enqueue deployment job for ID ${deploymentId}:`, error.message);
        throw error;
    }
}
