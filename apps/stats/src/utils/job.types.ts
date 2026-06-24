export interface JobCounts {
  queued: number;
  processing: number;
  completed: number;
  failed: number;
  total: number;
}

export interface Stats {
  jobCounts: JobCounts;
  avgProcessingTimeSeconds: Record<string, number>;
  queueLength: number;
}
