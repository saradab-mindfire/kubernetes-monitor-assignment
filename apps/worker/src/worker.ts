import redisClient from "./helpers/redis";
import { processJob } from "./processor";

async function runWorker() {
  console.log("worker started, waiting for jobs...");
  while (true) {
    try {
      // BRPOP returns [key, value] when an item is available
      const res = await redisClient.brpop("job_queue", 0);
      if (!res) continue;
      const raw = Array.isArray(res) ? res[1] : res;
      const job = JSON.parse(raw as string);

      console.log(
        `Processing job ${job.id} of type ${job.type} with payload:`,
        job.payload,
      );

      // mark as processing
      await redisClient.hset(
        "job_status",
        job.id,
        JSON.stringify({ status: "processing" }),
      );

      // Process the job based on its type
      await processJob(job.type, job.payload);
      // simulate work
      await new Promise((r) => setTimeout(r, 1000));

      // mark as completed
      await redisClient.hset(
        "job_status",
        job.id,
        JSON.stringify({ status: "completed" }),
      );
      console.log(`Job ${job.id} completed`);
    } catch (err) {
      console.error("Worker loop error:", err);
      // small backoff on error
      await new Promise((r) => setTimeout(r, 1000));
    }
  }
}

runWorker().catch((err) => console.error("Worker failed to start:", err));
