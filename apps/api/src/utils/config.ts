import dotenv from "dotenv";

dotenv.config();

const config = {
  PORT: Number(process.env.PORT) || 3000,
  REDIS_HOST: process.env.REDIS_HOST || "localhost",
  REDIS_PORT: Number(process.env.REDIS_PORT) || 6379,
};

console.log(config);

export default config;
