kubectl delete job ingress-nginx-admission-create --namespace=ingress-nginx
kubectl delete job ingress-nginx-admission-patch --namespace=ingress-nginx

<!-- If can't access app -->

# 1. Patch ingress controller (one-time)

kubectl patch svc ingress-nginx-controller -n ingress-nginx -p '{"spec": {"type": "LoadBalancer"}}'

# 2. Verify it gets 127.0.0.1

kubectl get svc ingress-nginx-controller -n ingress-nginx

# EXTERNAL-IP should show 127.0.0.1 (minikube tunnel must be running)

# 3. In your hosts file (already open) — add this line:

127.0.0.1 api.local

Then hit http://api.local in your browser.
