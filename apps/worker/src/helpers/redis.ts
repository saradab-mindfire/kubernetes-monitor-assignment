import Redis from "ioredis";
import config from "./../utils/config";

const host = config.REDIS_HOST || process.env.REDIS_HOST || "localhost";
const port = Number(config.REDIS_PORT || process.env.REDIS_PORT || 6379);
const password = config.REDIS_PASSWORD || process.env.REDIS_PASSWORD || "";

const redisClient = new Redis({
  host,
  port,
  ...(password && { password }),
  retryStrategy(times) {
    const delay = Math.min(1000 * 2 ** times, 30000);
    return delay;
  },
});

redisClient.on("connect", () => {
  console.log(`[redis] Connected to ${host}:${port}`);
});

redisClient.on("error", (err) => {
  console.error("[redis] error", err && err.message ? err.message : err);
});

export default redisClient;
