# Run Health Check Stress Testing

.\ab.exe -n 1000 -c 50 http://api.local/health

# Run Stress Testing for Jobs Fetching

.\ab.exe -n 500 -c 25 http://api.local/jobs

# Run And Test CPU Intensive Jobs

.\ab.exe -n 500 -c 25 -p payload.json -T "application/json" http://api.local/submit

# Check CPU And Processes

while($true) { Clear-Host; kubectl get hpa,pods -n monitoring-app; Start-Sleep 5 }
