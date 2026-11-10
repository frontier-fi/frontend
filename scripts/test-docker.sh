#!/usr/bin/env bash
set -euo pipefail

CONTAINER_NAME="frontier-web"
IMAGE_TAG="frontier-frontend:test"

cleanup() {
  docker rm -f "${CONTAINER_NAME}" >/dev/null 2>&1 || true
}
trap cleanup EXIT

cleanup

docker build \
  "$@" \
  --platform linux/amd64 \
  --tag "${IMAGE_TAG}" \
  --build-arg NEXT_PUBLIC_APP_ENV=prod \
  --build-arg NEXT_PUBLIC_API_URL="${NEXT_PUBLIC_API_URL:-https://api.frontier.fi/graphql}" \
  --build-arg NEXT_PUBLIC_WALLET_CONNECT_ID="${NEXT_PUBLIC_WALLET_CONNECT_ID:-}" \
  .

docker run -d --name "${CONTAINER_NAME}" -p 8080:8080 "${IMAGE_TAG}"

for _ in $(seq 1 30); do
  if curl -fsS http://localhost:8080/api/health | grep -q '"status":"ok"'; then
    echo "Container healthcheck passed"
    exit 0
  fi
  sleep 1
done

docker logs "${CONTAINER_NAME}"
exit 1
