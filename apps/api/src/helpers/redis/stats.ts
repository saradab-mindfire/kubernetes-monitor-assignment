import redisClient from "./redis";

interface JobCounts {
  queued: number;
  processing: number;
  completed: number;
  failed: number;
  total: number;
}

interface Stats {
  jobCounts: JobCounts;
  avgProcessingTimeSeconds: Record<string, number>;
  queueLength: number;
}

export async function buildStats(): Promise<Stats> {
  const [allJobs, queueLength, sumKeys] = await Promise.all([
    redisClient.hgetall("jobs"),
    redisClient.llen("job_queue"),
    redisClient.keys("metrics:job_processing_time_seconds_sum:*"),
  ]);

  const jobCounts: JobCounts = {
    queued: 0,
    processing: 0,
    completed: 0,
    failed: 0,
    total: 0,
  };
  for (const raw of Object.values(allJobs ?? {})) {
    const { status } = JSON.parse(raw);
    if (status in jobCounts) jobCounts[status as keyof JobCounts]++;
    jobCounts.total++;
  }

  const avgProcessingTimeSeconds: Record<string, number> = {};
  let totalSum = 0;
  let totalCount = 0;

  await Promise.all(
    sumKeys.map(async (sumKey) => {
      const jobType = sumKey.split(":").pop()!;
      const [sumVal, countVal] = await Promise.all([
        redisClient.get(sumKey),
        redisClient.get(`metrics:job_processing_time_seconds_count:${jobType}`),
      ]);
      const sum = Number(sumVal) || 0;
      const count = Number(countVal) || 0;
      avgProcessingTimeSeconds[jobType] = count > 0 ? sum / count : 0;
      totalSum += sum;
      totalCount += count;
    }),
  );

  if (totalCount > 0) {
    avgProcessingTimeSeconds.overall = totalSum / totalCount;
  }

  return { jobCounts, avgProcessingTimeSeconds, queueLength };
}
