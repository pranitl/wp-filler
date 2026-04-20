#!/usr/bin/env bash
set -euo pipefail

export DISPLAY="${DISPLAY:-:99}"
export XVFB_WHD="${XVFB_WHD:-1920x1080x24}"

cleanup() {
  pkill -P $$ >/dev/null 2>&1 || true
}

trap cleanup EXIT

mkdir -p /tmp/.X11-unix /app/logs

Xvfb "$DISPLAY" -screen 0 "$XVFB_WHD" -ac +extension RANDR >/tmp/xvfb.log 2>&1 &
sleep 1

node src/server.js &
APP_PID=$!

wait "$APP_PID"
