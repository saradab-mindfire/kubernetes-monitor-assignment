1. Build images directly into Minikube
   minikube image build -f apps/api/Dockerfile -t monitoring-api .
   minikube image build -f apps/worker/Dockerfile -t monitoring-worker .

2. Restart the deployments to pick up the new images
   kubectl rollout restart deployment/monitoring-app -n monitoring-app
   kubectl rollout restart deployment/monitoring-worker -n monitoring-app

3. Watch the rollout complete
   kubectl rollout status deployment/monitoring-app -n monitoring-app
   kubectl rollout status deployment/monitoring-worker -n monitoring-app

4. Verify logs are clean
   kubectl logs -l app=monitoring-app -n monitoring-app --tail=20
   kubectl logs -l app=monitoring-worker -n monitoring-app --tail=20
