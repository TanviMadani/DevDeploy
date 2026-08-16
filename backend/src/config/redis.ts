import Redis, { RedisOptions } from "ioredis";
import dotenv from "dotenv";

dotenv.config();

export const REDIS_URL = process.env.REDIS_URL || "redis://localhost:6379";

export const getRedisOptions = (): RedisOptions => {
    return {
        maxRetriesPerRequest: null,
        enableReadyCheck: false,
        retryStrategy(times: number) {
            // Reconnect with backoff capped at 5 seconds
            const delay = Math.min(times * 500, 5000);
            return delay;
        },
    };
};

/**
 * Creates a new Redis connection instance configured for BullMQ with clean error handling.
 */
export const createRedisConnection = (): Redis => {
    const client = new Redis(REDIS_URL, getRedisOptions());

    client.on("error", (err: Error) => {
        // Clean log without leaking URL or credentials
        console.error(`[Redis] Connection error: ${err.message}`);
    });

    client.on("connect", () => {
        console.log("[Redis] Connected successfully");
    });

    return client;
};

// Singleton connection for shared queue operations
export const redisConnection = createRedisConnection();
