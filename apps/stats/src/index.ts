import express, { Request, Response } from "express";
import config from "./utils/config";
import redisClient from "./helpers/redis";
import { JobCounts, Stats } from "./utils/job.types";

const app = express();
app.use(express.json());

async function buildStats(): Promise<Stats> {
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

const HISTOGRAM_BUCKETS = [0.1, 0.5, 1, 2, 5, 10, 30];

async function redisNum(key: string): Promise<number> {
  const val = await redisClient.get(key);
  return Number(val) || 0;
}

async function buildMetricsText(): Promise<string> {
  const [allJobs, queueLength, processedKeys, errorKeys] = await Promise.all([
    redisClient.hgetall("jobs"),
    redisClient.llen("job_queue"),
    redisClient.keys("metrics:jobs_processed_total:*"),
    redisClient.keys("metrics:job_errors_total:*"),
  ]);

  let totalSubmitted = 0;
  let totalCompleted = 0;

  for (const raw of Object.values(allJobs ?? {})) {
    const { status } = JSON.parse(raw);
    totalSubmitted++;
    if (status === "completed") totalCompleted++;
  }

  const jobTypes = [...new Set([...processedKeys, ...errorKeys])].map(
    (k) => k.split(":").pop()!,
  );

  const lines: string[] = [];

  lines.push("# HELP total_jobs_submitted Total number of jobs ever submitted");
  lines.push("# TYPE total_jobs_submitted gauge");
  lines.push(`total_jobs_submitted ${totalSubmitted}`);

  lines.push("# HELP total_jobs_completed Total number of jobs successfully completed");
  lines.push("# TYPE total_jobs_completed gauge");
  lines.push(`total_jobs_completed ${totalCompleted}`);

  lines.push("# HELP queue_length Current number of jobs waiting in the queue");
  lines.push("# TYPE queue_length gauge");
  lines.push(`queue_length ${queueLength}`);

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
    for (const le of HISTOGRAM_BUCKETS) {
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

app.get("/health", (_req: Request, res: Response) => {
  res.status(200).json({ status: "ok" });
});

app.get("/stats", async (_req: Request, res: Response) => {
  try {
    const stats = await buildStats();
    res.status(200).json(stats);
  } catch (error) {
    console.error("Error building stats:", error);
    res.status(500).json({ message: "Failed to build stats." });
  }
});

app.get("/metrics", async (_req: Request, res: Response) => {
  try {
    const text = await buildMetricsText();
    res.set("Content-Type", "text/plain; version=0.0.4; charset=utf-8");
    res.status(200).send(text);
  } catch (error) {
    console.error("Error building metrics:", error);
    res.status(500).json({ message: "Failed to build metrics." });
  }
});

app.listen(config.PORT, () => {
  console.log(`stats service listening on port ${config.PORT}`);
});
