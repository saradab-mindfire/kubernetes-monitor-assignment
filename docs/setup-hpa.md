# 1. HPA requires the metrics-server addon to be enabled in minikube:

minikube addons enable metrics-server

kubectl apply -f https://github.com/kubernetes-sigs/metrics-server/releases/latest/download/components.yaml

# 2. Verify metrics-server is running

kubectl get deployment metrics-server -n kube-system

# 3. Check HPA after ~1 minute

kubectl get hpa -n monitoring-app
