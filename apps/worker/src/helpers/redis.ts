import Redis from "ioredis";
import config from "./../utils/config";

const host = config.REDIS_HOST || process.env.REDIS_HOST || "localhost";
const port = Number(config.REDIS_PORT || process.env.REDIS_PORT || 6379);

const redisClient = new Redis({
  host,
  port,
  retryStrategy(times) {
    const delay = Math.min(1000 * 2 ** times, 30000);
    return delay;
  },
});

redisClient.on("connect", () => {
  console.log(`[redis] connected to ${host}:${port}`);
});

redisClient.on("error", (err) => {
  console.error("[redis] error", err && err.message ? err.message : err);
});

export default redisClient;
