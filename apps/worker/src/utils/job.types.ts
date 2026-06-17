export type JobStatus = "queued" | "processing" | "completed" | "failed";

export type JobType = "prime" | "bcrypt" | "sorting";

export interface Job {
  id: string;
  type: JobType;
  payload: string;
  status: JobStatus;
  createdAt: number;
  attempts?: number;
}
