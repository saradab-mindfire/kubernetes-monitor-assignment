---
GET /stats
---

Returns a JSON summary of job counts, average processing times, and current queue depth.

Endpoint: GET http://stats.local/stats  (stats service, port 3002)

The same endpoint is also available on the API service:
  GET http://api.local/stats  (API, port 3000)

Both read from the same Redis data and return identical response shapes.

---

How it works

Three Redis reads happen in parallel on each request:

  HGETALL jobs          → job records scanned to count by status
  LLEN job_queue        → number of jobs waiting to be picked up
  KEYS metrics:job_processing_time_seconds_sum:* → avg time per job type

The per-type averages are computed as sum / count using the same Redis keys
the worker writes to after each job (see docs/metrics.md).

---

Example response

{
  "jobCounts": {
    "queued": 3,
    "processing": 1,
    "completed": 42,
    "failed": 2,
    "total": 48
  },
  "avgProcessingTimeSeconds": {
    "prime": 1.23,
    "bcrypt": 0.45,
    "sorting": 2.11,
    "overall": 1.26
  },
  "queueLength": 3
}

---

Fields

jobCounts.queued       Jobs sitting in the Redis list, not yet picked up by a worker.
jobCounts.processing   Jobs currently being processed by a worker.
jobCounts.completed    Jobs that finished successfully.
jobCounts.failed       Jobs that threw an error during processing.
jobCounts.total        Sum of all statuses.

avgProcessingTimeSeconds
  Per job type: wall-clock seconds from dequeue to completion/failure, averaged
  over all runs since the worker last restarted or Redis was flushed.
  overall: weighted average across all job types.

queueLength            Current depth of the job_queue Redis list. This is the
                       number of jobs waiting for a free worker.

---

Related

- docs/metrics.md — Prometheus metrics exposed by the worker and stats service,
  including the same queue_length and job count data in scrape-friendly format.

---

Notes

- queueLength and jobCounts.queued can differ briefly — a job is popped from the
  queue (queueLength drops) before its status is written to the hash.
- avgProcessingTimeSeconds will be absent for a job type if no jobs of that type
  have completed yet.
- overall is omitted when no processing time data exists at all.
