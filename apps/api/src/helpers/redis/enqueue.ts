import redisClient from "./redis";

export type JobStatus = "queued" | "processing" | "completed" | "failed";

export type JobType = "prime" | "bycrypt" | "sorting";

export interface Job {
  id: string;
  type: "prime" | "bycrypt" | "sorting";
  payload: string;
  status: JobStatus;
  createdAt: number;
}

const JOBS_HASH = "jobs";

export async function enqueueJob(job: Job): Promise<string> {
  try {
    await Promise.all([
      redisClient.lpush("job_queue", JSON.stringify(job)),
      redisClient.hset(JOBS_HASH, job.id, JSON.stringify(job)),
    ]);
    console.log(`Job ${job.id} enqueued successfully.`);
    return job.id;
  } catch (error) {
    console.error(`Failed to enqueue job ${job.id}:`, error);
    throw error;
  }
}

export async function getJobStatus(jobId: string): Promise<JobStatus | null> {
  try {
    const raw = await redisClient.hget(JOBS_HASH, jobId);
    return raw ? (JSON.parse(raw).status as JobStatus) : null;
  } catch (error) {
    console.error(`Failed to get status for job ${jobId}:`, error);
    throw error;
  }
}

export async function getAllJobStatues(): Promise<Record<string, JobStatus>> {
  try {
    const all = await redisClient.hgetall(JOBS_HASH);
    const result: Record<string, JobStatus> = {};
    for (const [key, value] of Object.entries(all)) {
      result[key] = JSON.parse(value).status as JobStatus;
    }
    return result;
  } catch (error) {
    console.error("Failed to get all job statuses:", error);
    throw error;
  }
}
