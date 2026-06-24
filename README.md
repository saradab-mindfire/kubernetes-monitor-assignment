# Runbook — microservices-monitoring

A single reference for setup, operations, API, and troubleshooting.

---

## Table of Contents

1. [Prerequisites](#prerequisites)
2. [Initial Setup](#initial-setup)
3. [Daily Restart](#daily-restart)
4. [Updating App Code](#updating-app-code)
5. [Redeploying After YAML Changes](#redeploying-after-yaml-changes)
6. [HPA Setup](#hpa-setup)
7. [API Reference — GET /stats](#api-reference--get-stats)
8. [API Reference — GET /metrics](#api-reference--get-metrics)
9. [Troubleshooting](#troubleshooting)
10. [Teardown](#teardown)

---

## Prerequisites

- [Minikube](https://minikube.sigs.k8s.io/docs/start/) installed
- [kubectl](https://kubernetes.io/docs/tasks/tools/) installed
- [pnpm](https://pnpm.io/installation) installed (pnpm workspace context is required for Docker builds)
- Port 80 must be free (stop Apache or any other service using it)

---

## Initial Setup

Use this when starting from a completely clean state — new machine, after `minikube delete`, or when the cluster is broken beyond repair.

### Step 1 — Free Port 80

```powershell
# Run in admin PowerShell
Stop-Service -Name Apache* -Force
```

Verify port 80 is free (should return nothing):

```powershell
netstat -ano | Select-String ":80 " | Select-String "LISTENING"
```

### Step 2 — Start Minikube

```powershell
minikube start
```

### Step 3 — Enable Ingress Addon

```powershell
minikube addons enable ingress
```

Wait for the ingress controller to be ready before proceeding:

```powershell
kubectl wait --namespace ingress-nginx `
  --for=condition=ready pod `
  --selector=app.kubernetes.io/component=controller `
  --timeout=120s
```

### Step 4 — Build Docker Images into Minikube

Run from the **repo root** (pnpm workspace context is required):

```powershell
minikube image build -f apps/api/Dockerfile -t monitoring-api .
minikube image build -f apps/worker/Dockerfile -t monitoring-worker .
minikube image build -f apps/stats/Dockerfile -t monitoring-stats .
```

> These build directly inside Minikube's Docker daemon — no image push or registry needed.

### Step 5 — Deploy Everything

A single Kustomize command deploys the full stack in order:
`namespace → redis → worker → api → ingress`

```powershell
kubectl apply -k k8s/
```

Wait for all pods to be Running (Redis may take 30–60s):

```powershell
kubectl get pods -n monitoring-app --watch
```

Expected output once ready:

```
NAME                                 READY   STATUS    RESTARTS   AGE
monitoring-app-xxx                   1/1     Running   0          ...
monitoring-stats-xxx                 1/1     Running   0          ...
monitoring-worker-xxx                1/1     Running   0          ...
redis-0                              1/1     Running   0          ...
```

### Step 6 — Start Minikube Tunnel

Open a **separate admin PowerShell** window and run (keep it open):

```powershell
minikube tunnel
```

This assigns `127.0.0.1` as the external IP of the nginx ingress LoadBalancer service.
Closing this window will break ingress access.

### Step 7 — Configure Hosts File (one-time)

Run in **admin PowerShell**. Skip if `api.local` and `stats.local` and `worker.local` are already in your hosts file.

```powershell
Add-Content -Path "C:\Windows\System32\drivers\etc\hosts" -Value "127.0.0.1 api.local"
Add-Content -Path "C:\Windows\System32\drivers\etc\hosts" -Value "127.0.0.1 stats.local"
Add-Content -Path "C:\Windows\System32\drivers\etc\hosts" -Value "127.0.0.1 worker.local"
```

> Use `127.0.0.1`, not the minikube VM IP — `minikube tunnel` maps the LoadBalancer to localhost.

Verify:

```powershell
Get-Content "C:\Windows\System32\drivers\etc\hosts" | Select-String "\.local"
# Expected: 127.0.0.1 api.local, 127.0.0.1 stats.local, 127.0.0.1 worker.local
```

### Step 8 — Verify

```powershell
# All pods Running
kubectl get pods -n monitoring-app

# All services
kubectl get svc -n monitoring-app

# Ingress has ADDRESS 127.0.0.1
kubectl get ingress -n monitoring-app

# API health check
curl http://api.local/health
# Expected: {"status":"ok"}
```

---

## Daily Restart

After a system reboot you only need (hosts file, images, and K8s resources persist across reboots):

```powershell
minikube start           # any terminal
minikube tunnel          # admin PowerShell, keep open
```

---

## Updating App Code

After editing source files, rebuild images and roll the deployments:

```powershell
# 1. Rebuild images into Minikube
minikube image build -f apps/api/Dockerfile -t monitoring-api .
minikube image build -f apps/worker/Dockerfile -t monitoring-worker .
minikube image build -f apps/stats/Dockerfile -t monitoring-stats .

# 2. Restart deployments to pick up the new images
kubectl rollout restart deployment/monitoring-app -n monitoring-app
kubectl rollout restart deployment/monitoring-worker -n monitoring-app
kubectl rollout restart deployment/monitoring-stats -n monitoring-app

# 3. Watch rollouts complete
kubectl rollout status deployment/monitoring-app -n monitoring-app
kubectl rollout status deployment/monitoring-worker -n monitoring-app
kubectl rollout status deployment/monitoring-stats -n monitoring-app

# 4. Verify logs are clean
kubectl logs -l app=monitoring-app -n monitoring-app --tail=20
kubectl logs -l app=monitoring-worker -n monitoring-app --tail=20
kubectl logs -l app=monitoring-stats -n monitoring-app --tail=20
```

---

## Redeploying After YAML Changes

### Apply all changes at once (recommended)

```powershell
kubectl apply -k k8s/
```

Kustomize diffs and applies only what changed.

### Apply only a specific component

```powershell
kubectl apply -k k8s/app/      # only app changes
kubectl apply -k k8s/worker/   # only worker changes
kubectl apply -k k8s/redis/    # only redis changes
```

### Apply a single YAML file directly

```powershell
kubectl apply -f k8s/app/app.deployment.yaml
```

### Force restart pods after ConfigMap/Secret changes

ConfigMap and Secret changes are not automatically picked up by running pods — restart manually:

```powershell
kubectl rollout restart deployment <deployment-name> -n monitoring-app

# Check rollout status
kubectl rollout status deployment/<deployment-name> -n monitoring-app
```

---

## HPA Setup

HPA requires the metrics-server addon:

```powershell
# 1. Enable metrics-server in Minikube
minikube addons enable metrics-server

# Apply the upstream metrics-server manifest
kubectl apply -f https://github.com/kubernetes-sigs/metrics-server/releases/latest/download/components.yaml

# 2. Verify metrics-server is running
kubectl get deployment metrics-server -n kube-system

# 3. Check HPA after ~1 minute
kubectl get hpa -n monitoring-app
```

---

## API Reference — GET /stats

Returns a JSON summary of job counts, average processing times, and current queue depth.

| Service | Endpoint                                      |
| ------- | --------------------------------------------- |
| Stats   | `GET http://stats.local/stats` (port 3002)    |
| Worker  | `GET http://worker.local/metrics` (port 3001) |
| API     | `GET http://api.local/stats` (port 3000)      |

Both read from the same Redis data and return identical response shapes.

### How it works

Three Redis reads happen in parallel on each request:

```
HGETALL jobs          → job records scanned to count by status
LLEN job_queue        → number of jobs waiting to be picked up
KEYS metrics:job_processing_time_seconds_sum:*  → avg time per job type
```

Per-type averages are computed as `sum / count` using the same Redis keys the worker writes after each job.

### Example response

```json
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
```

### Fields

| Field                              | Description                                                                                                |
| ---------------------------------- | ---------------------------------------------------------------------------------------------------------- |
| `jobCounts.queued`                 | Jobs in the Redis list, not yet picked up by a worker                                                      |
| `jobCounts.processing`             | Jobs currently being processed                                                                             |
| `jobCounts.completed`              | Jobs that finished successfully                                                                            |
| `jobCounts.failed`                 | Jobs that threw an error during processing                                                                 |
| `jobCounts.total`                  | Sum of all statuses                                                                                        |
| `avgProcessingTimeSeconds.<type>`  | Wall-clock seconds from dequeue to completion/failure, averaged over all runs since Redis was last flushed |
| `avgProcessingTimeSeconds.overall` | Weighted average across all job types                                                                      |
| `queueLength`                      | Current depth of the `job_queue` Redis list                                                                |

### Notes

- `queueLength` and `jobCounts.queued` can differ briefly — a job is popped from the queue before its status is written to the hash.
- `avgProcessingTimeSeconds` will be absent for a job type if no jobs of that type have completed yet.
- `overall` is omitted when no processing time data exists at all.

---

## API Reference — GET /metrics

Two services expose a Prometheus-formatted `/metrics` endpoint.

| Service | Endpoint                          | Port |
| ------- | --------------------------------- | ---- |
| Worker  | `GET http://worker.local/metrics` | 3001 |
| Stats   | `GET http://stats.local/metrics`  | 3002 |
| API     | `GET http://api.local/metrics`    | 3000 |

> The API `/metrics` exposes the same worker job counters (reads the same Redis keys) and can be used interchangeably with the worker endpoint.

### Worker /metrics

Exposes per-job processing detail — counters and a histogram per job type.

**How it works:** the worker writes raw metric values to Redis atomically after every job. The `/metrics` endpoint reads those keys from Redis on each scrape and formats them as Prometheus exposition text.

**Redis keys written by worker:**

```
metrics:jobs_processed_total:{job_type}                    INCR
metrics:job_errors_total:{job_type}                        INCR
metrics:job_processing_time_seconds_sum:{job_type}         INCRBYFLOAT
metrics:job_processing_time_seconds_count:{job_type}       INCR
metrics:job_processing_time_seconds_bucket:{le}:{job_type} INCR
```

**Metrics exposed:**

| Metric                        | Type      | Description                                                                                                            |
| ----------------------------- | --------- | ---------------------------------------------------------------------------------------------------------------------- |
| `jobs_processed_total`        | counter   | Total jobs completed successfully, labelled by `job_type`                                                              |
| `job_errors_total`            | counter   | Total jobs failed, labelled by `job_type`                                                                              |
| `job_processing_time_seconds` | histogram | Wall-clock time from dequeue to completion/failure, labelled by `job_type`. Buckets: 0.1, 0.5, 1, 2, 5, 10, 30 seconds |

**Example response:**

```
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
```

### Stats service /metrics

Exposes high-level aggregate gauges — total submissions, completions, and live queue depth.

**How it works:** on each scrape, the stats service reads `HGETALL jobs` and `LLEN job_queue` from Redis and derives the three gauges inline.

**Metrics exposed:**

| Metric                 | Type  | Description                                   |
| ---------------------- | ----- | --------------------------------------------- |
| `total_jobs_submitted` | gauge | Total jobs ever submitted (all statuses)      |
| `total_jobs_completed` | gauge | Total jobs that reached `completed` status    |
| `queue_length`         | gauge | Current number of jobs waiting in `job_queue` |

**Example response:**

```
# HELP total_jobs_submitted Total number of jobs ever submitted
# TYPE total_jobs_submitted gauge
total_jobs_submitted 59

# HELP total_jobs_completed Total number of jobs successfully completed
# TYPE total_jobs_completed gauge
total_jobs_completed 42

# HELP queue_length Current number of jobs waiting in the queue
# TYPE queue_length gauge
queue_length 3
```

### Prometheus scrape config (pod annotations)

Both the worker and stats pods carry these annotations for auto-discovery:

```yaml
prometheus.io/scrape: "true"
prometheus.io/path: "/metrics"
prometheus.io/port: "<3001 or 3002>"
```

### Notes

- Job types in the worker endpoint are discovered dynamically from Redis keys — no config change needed when new job types are added.
- Metrics persist across worker restarts because they live in Redis, not worker memory.
- If no jobs have been processed yet, the worker `/metrics` response body will be empty.

---

## Troubleshooting

### General

| Symptom                                   | Fix                                                  |
| ----------------------------------------- | ---------------------------------------------------- |
| `ImagePullBackOff`                        | Step 4 was skipped — rebuild images into Minikube    |
| `CrashLoopBackOff`                        | Run `kubectl logs <pod-name> -n monitoring-app`      |
| `curl: Could not resolve host: api.local` | Hosts file missing entry — redo Step 7               |
| `curl` times out on `api.local`           | `minikube tunnel` not running — redo Step 6          |
| Redis pods not Ready                      | Wait 30–60s, worker/api will reconnect automatically |
| Port 80 conflict                          | Stop whatever holds port 80 — redo Step 1            |

### Useful debug commands

```powershell
# View logs for a service
kubectl logs -l app=monitoring-app -n monitoring-app
kubectl logs -l app=monitoring-worker -n monitoring-app
kubectl logs -l app=monitoring-stats -n monitoring-app

# Describe a pod that is not starting
kubectl describe pod <pod-name> -n monitoring-app
```

### Ingress not accessible after setup

If the app is unreachable even when `minikube tunnel` is running:

```powershell
# 1. Delete stale ingress admission jobs (harmless if they don't exist)
kubectl delete job ingress-nginx-admission-create --namespace=ingress-nginx
kubectl delete job ingress-nginx-admission-patch --namespace=ingress-nginx

# 2. Patch ingress controller to LoadBalancer type (one-time)
kubectl patch svc ingress-nginx-controller -n ingress-nginx -p '{"spec": {"type": "LoadBalancer"}}'

# 3. Verify external IP is 127.0.0.1 (minikube tunnel must be running)
kubectl get svc ingress-nginx-controller -n ingress-nginx
```

Then confirm the hosts file entry exists (Step 7) and hit `http://api.local` in the browser.

---

## Terminate Services

```powershell
kubectl delete -k k8s/   # remove all app resources
```
