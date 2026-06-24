# Fresh Start Guide

Use this when starting from a completely clean state — new machine, after `minikube delete`, or when the cluster is broken beyond repair.

---

## Prerequisites

- [Minikube](https://minikube.sigs.k8s.io/docs/start/) installed
- [kubectl](https://kubernetes.io/docs/tasks/tools/) installed
- [pnpm](https://pnpm.io/installation) installed (for building Docker images)
- Port 80 must be free (Apache or any other service using it must be stopped)

---

## Step 1 — Free Port 80

If Apache or any other service is using port 80, stop it first.

```powershell
# Run in admin PowerShell
Stop-Service -Name Apache* -Force
```

Verify port 80 is free (should return nothing):

```powershell
netstat -ano | Select-String ":80 " | Select-String "LISTENING"
```

---

## Step 2 — Start Minikube

```powershell
minikube start
```

---

## Step 3 — Enable Ingress Addon

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

---

## Step 4 — Build Docker Images into Minikube

Run from the **repo root** (pnpm workspace context is required):

```powershell
minikube image build -f apps/api/Dockerfile -t monitoring-api .
minikube image build -f apps/worker/Dockerfile -t monitoring-worker .
```

> These build directly inside Minikube's Docker daemon so no image push or registry is needed.

---

## Step 5 — Deploy Everything

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
monitoring-worker-xxx                1/1     Running   0          ...
redis-0                              1/1     Running   0          ...
```

---

## Step 6 — Start Minikube Tunnel

Open a **separate admin PowerShell** window and run (keep it open):

```powershell
minikube tunnel
```

This assigns `127.0.0.1` as the external IP of the nginx ingress LoadBalancer service.
Closing this window will break ingress access.

---

## Step 7 — Configure Hosts File (one-time)

Run in **admin PowerShell**. Skip this step if `api.local` is already in your hosts file.

```powershell
Add-Content -Path "C:\Windows\System32\drivers\etc\hosts" -Value "127.0.0.1 api.local"
```

> Use `127.0.0.1`, not the minikube VM IP — `minikube tunnel` maps the LoadBalancer to localhost.

Verify:

```powershell
Get-Content "C:\Windows\System32\drivers\etc\hosts" | Select-String "api.local"
# Expected: 127.0.0.1 api.local
```

---

## Step 8 — Verify

```powershell
# All pods Running
kubectl get pods -n monitoring-app

# Ingress has ADDRESS 127.0.0.1
kubectl get ingress -n monitoring-app

# API health check
curl http://api.local/health
# Expected: {"status":"ok"}
```

---

## Troubleshooting

| Symptom                                   | Fix                                                  |
| ----------------------------------------- | ---------------------------------------------------- |
| `ImagePullBackOff`                        | Step 4 was skipped — rebuild images into Minikube    |
| `CrashLoopBackOff`                        | Run `kubectl logs <pod-name> -n monitoring-app`      |
| `curl: Could not resolve host: api.local` | Hosts file missing entry — redo Step 7               |
| `curl` times out on `api.local`           | `minikube tunnel` not running — redo Step 6          |
| Redis pods not Ready                      | Wait 30–60s, worker/api will reconnect automatically |
| Port 80 conflict                          | Stop whatever holds port 80 — redo Step 1            |

---

## Daily Restart (cluster already set up)

After a system reboot you only need:

```powershell
minikube start                # any terminal
minikube tunnel               # admin PowerShell, keep open
```

The hosts file entry, images, and K8s resources all persist across reboots.

---

## Teardown

```powershell
kubectl delete -k k8s/   # remove all app resources
minikube delete           # wipe the cluster entirely
```
