---
After Changing YAML Files & How to Redeploy

1. Apply all changes at once (recommended & uses Kustomize root)

kubectl apply -k k8s/
This applies everything under k8s/ including all subfolders (redis, worker, app).
---

2. Apply only a specific component

# Only app changes

kubectl apply -k k8s/app/

# Only worker changes

kubectl apply -k k8s/worker/

# Only redis changes

kubectl apply -k k8s/redis/

---

3. Apply a single YAML file directly

kubectl apply -f k8s/app/app.deployment.yaml

---

Force restart pods after ConfigMap/Secret changes

kubectl rollout restart deployment <deployment-name> -n <namespace>

# Example for your app

kubectl rollout restart deployment app -n default

Check rollout status

kubectl rollout status deployment/app -n <namespace>

TL;DR: Run kubectl apply -k k8s/ after any YAML change â Kustomize will diff and apply only what's different. Then restart pods if you changed ConfigMaps or Secrets.
