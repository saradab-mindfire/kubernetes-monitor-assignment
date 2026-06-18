---
Prerequisites

1. Start Minikube
minikube start
minikube tunnel     -    open in a admin powershell

2. Enable the ingress addon
minikube addons enable ingress

3. Build images directly into Minikube
minikube image build -f apps/api/Dockerfile -t monitoring-api .
minikube image build -f apps/worker/Dockerfile -t monitoring-worker .
---

Deploy Everything

Since you're using Kustomize, a single command deploys the full stack (namespace → redis → worker → app → ingress):

kubectl apply -k k8s/

This applies your root k8s/kustomization.yaml which orchestrates everything in order.

---

Verify Deployment

# Check all pods are Running

kubectl get pods -n monitoring-app

# Check all services

kubectl get svc -n monitoring-app

# Check ingress

kubectl get ingress -n monitoring-app

---

Access the API

Since your ingress uses host api.local, you need to map it:

1. Get Minikube's IP
   minikube ip

2. Add to hosts file (run PowerShell as Administrator)
   Add-Content -Path "C:\Windows\System32\drivers\etc\hosts" -Value "<minikube-ip> api.local"

3. Hit the API
   curl http://api.local

---

Useful Debug Commands

# View logs for api pods

kubectl logs -l app=monitoring-app -n monitoring-app

# View logs for worker pods

kubectl logs -l app=monitoring-worker -n monitoring-app

# Describe a pod if it's not starting

kubectl describe pod <pod-name> -n monitoring-app

# Teardown everything

kubectl delete -k k8s/

---

Key things to watch for:

- If pods show ImagePullBackOff → the minikube image load step was missed
- If pods show CrashLoopBackOff → check logs with kubectl logs
- Redis pods may take 30–60s to become Ready before app/worker connect successfully
