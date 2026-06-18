import express, { Request, Response } from "express";
import config from "./utils/config";
import {
  enqueueJob,
  getAllJobStatues,
  getJobStatus,
} from "./helpers/redis/enqueue";

const app = express();
app.use(express.json());

app.get("/health", (req: Request, res: Response) => {
  res.status(200).json({ status: "ok" });
});

app.post("/submit", async (req: Request, res: Response) => {
  try {
    const data = {
      type: req.body.type,
      payload: req.body.payload,
    };

    const { v4: uuid } = await import("uuid");

    const job = {
      id: uuid(),
      type: data.type ?? "prime",
      payload: data.payload ?? "10000",
      status: "queued" as const,
      createdAt: Date.now(),
    };

    await enqueueJob(job);

    res.status(200).json({ message: "Job submitted successfully.", job });
  } catch (error) {
    console.error("Error submitting job:", error);
    res.status(500).json({ message: "Failed to submit job." });
  }
});

app.post("/status/:id", async (req: Request, res: Response) => {
  try {
    const jobId = req.params.id as string;
    const jobStatus = await getJobStatus(jobId);
    if (jobStatus) {
      res.status(200).json({ jobId, status: jobStatus });
    } else {
      res.status(404).json({ message: "Job not found." });
    }
  } catch (error) {
    console.error("Error fetching job status:", error);
    res.status(500).json({ message: "Failed to fetch job status." });
  }
});

app.get("/jobs", async (req: Request, res: Response) => {
  try {
    const jobStatuses = await getAllJobStatues();
    res.status(200).json({ jobStatuses });
  } catch (error) {
    console.error("Error fetching all job statuses:", error);
    res.status(500).json({ message: "Failed to fetch all job statuses." });
  }
});

app.listen(config.PORT, () => {
  console.log(`api listening on port ${config.PORT}`);
});
