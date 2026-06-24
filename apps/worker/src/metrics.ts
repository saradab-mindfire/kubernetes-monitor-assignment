import redisClient from "./helpers/redis";

const BUCKETS = [0.1, 0.5, 1, 2, 5, 10, 30];

export async function incJobsProcessed(jobType: string): Promise<void> {
  await redisClient.incr(`metrics:jobs_processed_total:${jobType}`);
}

export async function incJobErrors(jobType: string): Promise<void> {
  await redisClient.incr(`metrics:job_errors_total:${jobType}`);
}

export async function recordProcessingTime(jobType: string, durationSeconds: number): Promise<void> {
  const pipeline = redisClient.pipeline();
  pipeline.incrbyfloat(`metrics:job_processing_time_seconds_sum:${jobType}`, durationSeconds);
  pipeline.incr(`metrics:job_processing_time_seconds_count:${jobType}`);
  for (const le of BUCKETS) {
    if (durationSeconds <= le) {
      pipeline.incr(`metrics:job_processing_time_seconds_bucket:${le}:${jobType}`);
    }
  }
  pipeline.incr(`metrics:job_processing_time_seconds_bucket:+Inf:${jobType}`);
  await pipeline.exec();
}

async function getJobTypes(): Promise<string[]> {
  const processedKeys = await redisClient.keys("metrics:jobs_processed_total:*");
  const errorKeys = await redisClient.keys("metrics:job_errors_total:*");
  const allKeys = [...new Set([...processedKeys, ...errorKeys])];
  return allKeys.map((k) => k.split(":").pop()!);
}

async function redisNum(key: string): Promise<number> {
  const val = await redisClient.get(key);
  return Number(val) || 0;
}

export async function buildMetricsText(): Promise<string> {
  const jobTypes = await getJobTypes();
  const lines: string[] = [];

  lines.push("# HELP jobs_processed_total Total number of jobs successfully processed");
  lines.push("# TYPE jobs_processed_total counter");
  for (const jt of jobTypes) {
    const val = await redisNum(`metrics:jobs_processed_total:${jt}`);
    lines.push(`jobs_processed_total{job_type="${jt}"} ${val}`);
  }

  lines.push("# HELP job_errors_total Total number of jobs that failed");
  lines.push("# TYPE job_errors_total counter");
  for (const jt of jobTypes) {
    const val = await redisNum(`metrics:job_errors_total:${jt}`);
    lines.push(`job_errors_total{job_type="${jt}"} ${val}`);
  }

  lines.push("# HELP job_processing_time_seconds Time spent processing a job in seconds");
  lines.push("# TYPE job_processing_time_seconds histogram");
  for (const jt of jobTypes) {
    for (const le of BUCKETS) {
      const val = await redisNum(`metrics:job_processing_time_seconds_bucket:${le}:${jt}`);
      lines.push(`job_processing_time_seconds_bucket{job_type="${jt}",le="${le}"} ${val}`);
    }
    const infVal = await redisNum(`metrics:job_processing_time_seconds_bucket:+Inf:${jt}`);
    lines.push(`job_processing_time_seconds_bucket{job_type="${jt}",le="+Inf"} ${infVal}`);
    const sum = await redisNum(`metrics:job_processing_time_seconds_sum:${jt}`);
    const count = await redisNum(`metrics:job_processing_time_seconds_count:${jt}`);
    lines.push(`job_processing_time_seconds_sum{job_type="${jt}"} ${sum}`);
    lines.push(`job_processing_time_seconds_count{job_type="${jt}"} ${count}`);
  }

  return lines.join("\n") + "\n";
}
