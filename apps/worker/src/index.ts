import express, { Request, Response } from "express";
import "./worker";
import { buildMetricsText } from "./metrics";
import config from "./utils/config";

const app = express();

app.get("/health", (_req: Request, res: Response) => {
  res.status(200).json({ status: "ok" });
});

app.get("/metrics", async (_req: Request, res: Response) => {
  try {
    const text = await buildMetricsText();
    res.set("Content-Type", "text/plain; version=0.0.4; charset=utf-8");
    res.status(200).send(text);
  } catch (err) {
    res.status(500).json({ message: "Failed to build metrics" });
  }
});

app.listen(config.PORT, () => {
  console.log(`metrics server listening on port ${config.PORT}`);
});
