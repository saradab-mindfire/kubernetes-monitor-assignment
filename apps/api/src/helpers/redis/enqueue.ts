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

export async function enqueueJob(job: Job): Promise<string> {
  try {
    await redisClient.lpush("job_queue", JSON.stringify(job));
    console.log(`Job ${job.id} enqueued successfully.`);
    return job.id;
  } catch (error) {
    console.error(`Failed to enqueue job ${job.id}:`, error);
    throw error;
  }
}

export async function getJobStatus(jobId: string): Promise<JobStatus | null> {
  try {
    const jobData = await redisClient.hget("job_status", jobId);
    return jobData ? (JSON.parse(jobData).status as JobStatus) : null;
  } catch (error) {
    console.error(`Failed to get status for job ${jobId}:`, error);
    throw error;
  }
}
