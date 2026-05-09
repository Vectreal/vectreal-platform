#!/usr/bin/env bash
set -euo pipefail

HEALTH_CHECK_URL="${1:?Health check URL required}"
MAX_RETRIES="${2:-8}"
RETRY_DELAY="${3:-15}"

echo "Health check URL: $HEALTH_CHECK_URL"
echo "Max retries: $MAX_RETRIES"

for attempt in $(seq 1 "$MAX_RETRIES"); do
  echo "Health check attempt $attempt/$MAX_RETRIES..."

  response_file="$(mktemp)"
  status_code="$(curl -sS -L \
    -A "GitHubActions-HealthCheck/1.0" \
    -H "Accept: application/json" \
    --connect-timeout 5 \
    --max-time 15 \
    -o "$response_file" \
    -w "%{http_code}" \
    "$HEALTH_CHECK_URL" || echo "000")"

  if [[ "$status_code" =~ ^2[0-9][0-9]$ ]]; then
    echo "✅ Service is healthy! (HTTP $status_code)"
    rm -f "$response_file"
    exit 0
  fi

  echo "❌ Health check failed: HTTP $status_code"
  if [ -s "$response_file" ]; then
    echo "Response body (first 300 chars):"
    head -c 300 "$response_file"
    echo
  fi
  rm -f "$response_file"

  if [ "$attempt" -lt "$MAX_RETRIES" ]; then
    echo "⏳ Waiting ${RETRY_DELAY}s before retry..."
    sleep "$RETRY_DELAY"
  fi
done

echo "❌ Service health check failed after $MAX_RETRIES attempts"
exit 1
