import dotenv from "dotenv";

dotenv.config();

const config = {
  PORT: Number(process.env.PORT) || 3002,
  REDIS_HOST: process.env.REDIS_HOST || "localhost",
  REDIS_PORT: Number(process.env.REDIS_PORT) || 6379,
  REDIS_PASSWORD: process.env.REDIS_PASSWORD || "",
};

export default config;
