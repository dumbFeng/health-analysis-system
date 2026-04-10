#!/usr/bin/env bash

set -euo pipefail

cleanup() {
  if [[ -n "${NEXT_PID:-}" ]] && kill -0 "$NEXT_PID" 2>/dev/null; then
    kill "$NEXT_PID" 2>/dev/null || true
  fi
}

trap cleanup EXIT INT TERM

if ! command -v cloudflared >/dev/null 2>&1; then
  echo "cloudflared is not installed."
  echo "Install it first, then rerun: npm run share:prod"
  exit 1
fi

echo "Building production bundle ..."
npm run build

echo "Starting Next.js production server on http://127.0.0.1:3000 ..."
npm run start:local &
NEXT_PID=$!

echo "Waiting for local server to be ready ..."
for _ in {1..60}; do
  if curl -fsS "http://127.0.0.1:3000" >/dev/null 2>&1; then
    break
  fi
  sleep 1
done

if ! curl -fsS "http://127.0.0.1:3000" >/dev/null 2>&1; then
  echo "Local production server did not become ready in time."
  exit 1
fi

echo "Opening Cloudflare quick tunnel ..."
cloudflared tunnel --url http://127.0.0.1:3000
