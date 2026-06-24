---
GET /metrics
---

Two services expose a Prometheus-formatted /metrics endpoint. Each scrapes a different
concern: the worker exposes per-job processing detail; the stats service exposes
aggregate submission and queue depth gauges.

---

Worker /metrics  (port 3001)
---

Endpoint: GET http://worker.local/metrics

Exposes how the worker is processing jobs — counters and a histogram per job type.

How it works

The worker writes raw metric values to Redis atomically after every job. The /metrics
endpoint reads those keys from Redis on each scrape and formats them as Prometheus
exposition text.

Worker → Redis (on job complete/fail)
  metrics:jobs_processed_total:{job_type}                    INCR
  metrics:job_errors_total:{job_type}                        INCR
  metrics:job_processing_time_seconds_sum:{job_type}         INCRBYFLOAT
  metrics:job_processing_time_seconds_count:{job_type}       INCR
  metrics:job_processing_time_seconds_bucket:{le}:{job_type} INCR

Worker HTTP → reads Redis keys → formats Prometheus text → returns response

Metrics exposed

jobs_processed_total (counter)
  Total jobs that completed successfully, labelled by job_type.

job_errors_total (counter)
  Total jobs that failed, labelled by job_type.

job_processing_time_seconds (histogram)
  Wall-clock time from job dequeue to completion/failure, labelled by job_type.
  Buckets: 0.1, 0.5, 1, 2, 5, 10, 30 seconds.

Example response

# HELP jobs_processed_total Total number of jobs successfully processed
# TYPE jobs_processed_total counter
jobs_processed_total{job_type="prime"} 42
jobs_processed_total{job_type="bcrypt"} 10
jobs_processed_total{job_type="sorting"} 7

# HELP job_errors_total Total number of jobs that failed
# TYPE job_errors_total counter
job_errors_total{job_type="prime"} 1
job_errors_total{job_type="bcrypt"} 0
job_errors_total{job_type="sorting"} 2

# HELP job_processing_time_seconds Time spent processing a job in seconds
# TYPE job_processing_time_seconds histogram
job_processing_time_seconds_bucket{job_type="prime",le="0.1"} 0
job_processing_time_seconds_bucket{job_type="prime",le="0.5"} 3
...
job_processing_time_seconds_bucket{job_type="prime",le="+Inf"} 42
job_processing_time_seconds_sum{job_type="prime"} 51.84
job_processing_time_seconds_count{job_type="prime"} 42

Prometheus scrape config

The worker pod has these annotations so Prometheus auto-discovers it:

  prometheus.io/scrape: "true"
  prometheus.io/path: "/metrics"
  prometheus.io/port: "3001"

---

Stats service /metrics  (port 3002)
---

Endpoint: GET http://stats.local/metrics

Exposes high-level aggregate gauges — total submissions, completions, and live queue depth.

How it works

On each scrape the stats service scans the jobs hash (HGETALL jobs) and the queue
length (LLEN job_queue) from Redis and derives the three gauges inline.

Stats service → reads Redis → formats Prometheus text → returns response

Metrics exposed

total_jobs_submitted (gauge)
  Total number of jobs ever submitted (all statuses combined).

total_jobs_completed (gauge)
  Total number of jobs that reached completed status.

queue_length (gauge)
  Current number of jobs waiting in the job_queue Redis list.

Example response

# HELP total_jobs_submitted Total number of jobs ever submitted
# TYPE total_jobs_submitted gauge
total_jobs_submitted 59

# HELP total_jobs_completed Total number of jobs successfully completed
# TYPE total_jobs_completed gauge
total_jobs_completed 42

# HELP queue_length Current number of jobs waiting in the queue
# TYPE queue_length gauge
queue_length 3

Prometheus scrape config

The stats pod has these annotations so Prometheus auto-discovers it:

  prometheus.io/scrape: "true"
  prometheus.io/path: "/metrics"
  prometheus.io/port: "3002"

---

Notes

- Job types in the worker endpoint are discovered dynamically from Redis keys — no
  config change is needed when new job types are added.
- Metrics persist across worker restarts because they live in Redis, not worker memory.
- If no jobs have been processed yet, the worker /metrics response body will be empty.
- The API service (port 3000) also exposes GET /metrics with the same worker job
  counters, reading from the same Redis keys. It can be used interchangeably with the
  worker endpoint.
