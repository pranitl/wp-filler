#!/usr/bin/env bash
set -euo pipefail

export DISPLAY="${DISPLAY:-:99}"
export XVFB_WHD="${XVFB_WHD:-1920x1080x24}"
export VNC_PORT="${VNC_PORT:-5900}"
export NOVNC_PORT="${NOVNC_PORT:-7900}"

cleanup() {
  pkill -P $$ >/dev/null 2>&1 || true
}

trap cleanup EXIT

mkdir -p /tmp/.X11-unix /app/logs

Xvfb "$DISPLAY" -screen 0 "$XVFB_WHD" -ac +extension RANDR >/tmp/xvfb.log 2>&1 &
sleep 1

fluxbox >/tmp/fluxbox.log 2>&1 &
x11vnc -display "$DISPLAY" -forever -shared -nopw -rfbport "$VNC_PORT" >/tmp/x11vnc.log 2>&1 &
websockify --web=/usr/share/novnc/ "$NOVNC_PORT" "localhost:$VNC_PORT" >/tmp/websockify.log 2>&1 &

node src/server.js &
APP_PID=$!

wait "$APP_PID"
