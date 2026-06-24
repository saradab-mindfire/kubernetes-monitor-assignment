import redisClient from "./helpers/redis";
import { Job, JobStatus } from "./utils/job.types";
import { processJob } from "./processor";
import { incJobsProcessed, incJobErrors, recordProcessingTime } from "./metrics";

const JOBS_HASH = "jobs";

async function updateJobStatus(jobId: string, status: JobStatus): Promise<void> {
  const raw = await redisClient.hget(JOBS_HASH, jobId);
  const job: Partial<Job> = raw ? JSON.parse(raw) : { id: jobId };
  await redisClient.hset(JOBS_HASH, jobId, JSON.stringify({ ...job, status }));
}

async function runWorker() {
  console.log("worker started, waiting for jobs...");
  while (true) {
    let jobId: string | undefined;
    try {
      const res = await redisClient.brpop("job_queue", 0);
      console.log("Received job from queue:", res);
      if (!res) continue;
      const raw = Array.isArray(res) ? res[1] : res;
      const job = JSON.parse(raw as string);
      jobId = job.id;

      console.log(
        `Processing job ${job.id} of type ${job.type} with payload:`,
        job.payload,
      );

      await updateJobStatus(job.id, "processing");

      const startTime = Date.now();
      try {
        await processJob(job.type, job.payload);
        const durationSeconds = (Date.now() - startTime) / 1000;
        await Promise.all([
          incJobsProcessed(job.type),
          recordProcessingTime(job.type, durationSeconds),
        ]);
        await updateJobStatus(job.id, "completed");
        console.log(`Job ${job.id} completed`);
      } catch (err) {
        const durationSeconds = (Date.now() - startTime) / 1000;
        await Promise.all([
          incJobErrors(job.type),
          recordProcessingTime(job.type, durationSeconds),
        ]);
        await updateJobStatus(job.id, "failed");
        console.error(`Job ${job.id} failed:`, err);
      }
    } catch (err) {
      console.error("Worker loop error:", err);
      if (jobId) {
        await updateJobStatus(jobId, "failed").catch(() => {});
      }
      await new Promise((r) => setTimeout(r, 1000));
    }
  }
}

runWorker().catch((err) => console.error("Worker failed to start:", err));
