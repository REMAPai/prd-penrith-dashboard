#!/usr/bin/env bash
# Queue a Dokploy deploy and wait for its build. A 2xx from application.deploy only means "queued",
# so we poll the new deployment and fail the job if Dokploy reports an error.
# Needs: DOKPLOY_URL, DOKPLOY_API_KEY, APPLICATION_ID (set by the workflow).
set -euo pipefail

api() { curl -sS -H "x-api-key: ${DOKPLOY_API_KEY}" -H "content-type: application/json" "$@"; }

# Prints "<deploymentId> <status>" of the newest deployment.
newest() {
  api "${DOKPLOY_URL}/api/application.one?applicationId=${APPLICATION_ID}" \
    | jq -r '[.deployments[]] | sort_by(.createdAt) | last | "\(.deploymentId // "") \(.status // "")"'
}

before=$(newest | cut -d" " -f1)

code=$(api -o /tmp/deploy.out -w "%{http_code}" -X POST "${DOKPLOY_URL}/api/application.deploy" \
  -d "{\"applicationId\":\"${APPLICATION_ID}\",\"title\":\"${GITHUB_SHA::7}\",\"description\":\"GitHub Actions ${GITHUB_RUN_ID}\"}")
echo "Dokploy responded ${code}"
if [ "${code}" -ge 300 ]; then
  cat /tmp/deploy.out
  exit 1
fi

for i in $(seq 1 60); do
  read -r id status <<< "$(newest)"
  echo "attempt ${i}: ${status:-none}"
  if [ -n "${id}" ] && [ "${id}" != "${before}" ]; then
    if [ "${status}" = "done" ]; then
      exit 0
    fi
    if [ "${status}" = "error" ]; then
      echo "Dokploy build failed. Last log lines:"
      api "${DOKPLOY_URL}/api/deployment.readLogs?deploymentId=${id}&tail=60" | jq -r . | tail -40
      exit 1
    fi
  fi
  sleep 15
done
echo "Dokploy build did not finish in 15 minutes"
exit 1
