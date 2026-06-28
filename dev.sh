#!/bin/bash

# Exit on error
set -e

SCRIPT_DIR="$( cd "$( dirname "${BASH_SOURCE[0]}" )" && pwd )"
SERVICES_DIR="$SCRIPT_DIR/services"
FRONTEND_DIR="$SCRIPT_DIR/frontend"
PID_DIR="/tmp/creator-copilot-pids"

mkdir -p "$PID_DIR"

start_service() {
  local name="$1"
  local port="$2"
  local module="$3"
  local pidfile="$PID_DIR/${name}.pid"
  local logfile="/tmp/cc-${name}.log"
  local screen_name="cc-${name}"

  local existing
  existing=$(lsof -t -i :"$port" 2>/dev/null || true)
  if [ -n "$existing" ]; then
    echo "-> ${name} already listening on port ${port} (pid ${existing})"
    echo "$existing" > "$pidfile"
    return 0
  fi

  # Detached screen survives terminal/agent session exit (nohup alone often does not).
  screen -S "$screen_name" -X quit 2>/dev/null || true
  screen -dmS "$screen_name" bash -c "cd '$SERVICES_DIR' && source venv/bin/activate && exec python -m uvicorn '$module' --host 127.0.0.1 --port '$port' >> '$logfile' 2>&1"
  sleep 1
  existing=$(lsof -t -i :"$port" 2>/dev/null || true)
  if [ -n "$existing" ]; then
    echo "$existing" > "$pidfile"
    echo "-> ${name} started on port ${port} (screen:${screen_name}, pid ${existing}, log: ${logfile})"
  else
    echo "-> WARNING: ${name} failed to bind port ${port} — check ${logfile}"
  fi
}

start_frontend() {
  local port=3030
  local pidfile="$PID_DIR/frontend.pid"
  local logfile="/tmp/cc-frontend.log"

  if ! command -v npm &>/dev/null; then
    echo "WARNING: npm not found — skipping frontend. Install Node.js to run the UI."
    return 1
  fi

  local existing
  existing=$(lsof -t -i :"$port" 2>/dev/null || true)
  if [ -n "$existing" ]; then
    echo "-> frontend already listening on port ${port} (pid ${existing})"
    echo "$existing" > "$pidfile"
    return 0
  fi

  if [ ! -d "$FRONTEND_DIR/node_modules" ]; then
    echo "Installing frontend dependencies (first run)..."
    (cd "$FRONTEND_DIR" && npm install --silent)
  fi

  nohup npm run dev --prefix "$FRONTEND_DIR" >> "$logfile" 2>&1 &
  local pid=$!
  echo "$pid" > "$pidfile"
  echo "-> frontend started on port ${port} (pid ${pid}, log: ${logfile})"
}

stop_service() {
  local name="$1"
  local port="$2"
  local pidfile="$PID_DIR/${name}.pid"

  if [ -f "$pidfile" ]; then
    local pid
    pid=$(cat "$pidfile")
    if kill -0 "$pid" 2>/dev/null; then
      kill "$pid" 2>/dev/null || true
      echo "Stopped ${name} (pid ${pid})"
    fi
    rm -f "$pidfile"
  fi

  local port_pid
  port_pid=$(lsof -t -i :"$port" 2>/dev/null || true)
  if [ -n "$port_pid" ]; then
    kill "$port_pid" 2>/dev/null || true
    echo "Stopped process on port ${port}"
  fi
}

stop_all() {
  echo "Stopping Creator Copilot services..."
  stop_service "frontend" 3030
  stop_service "research" 8001
  stop_service "scripting" 8002
  stop_service "media" 8003
  stop_service "seo" 8004
  pkill -f "video-worker.worker" 2>/dev/null || true
  rm -f "$PID_DIR/celery.pid"
}

wait_for_port() {
  local port="$1"
  local label="$2"
  local path="${3:-/docs}"
  local tries="${4:-30}"

  for ((i = 1; i <= tries; i++)); do
    local code
    code=$(curl -s -o /dev/null -w "%{http_code}" "http://127.0.0.1:${port}${path}" 2>/dev/null || echo "000")
    if [[ "$code" =~ ^[23] ]]; then
      echo "   ${label} ready (port ${port})"
      return 0
    fi
    sleep 1
  done

  echo "   WARNING: ${label} not responding on port ${port} after ${tries}s — check /tmp/cc-${label}.log"
  return 1
}

check_status() {
  local name="$1"
  local port="$2"
  local path="${3:-/docs}"

  local code
  code=$(curl -s -o /dev/null -w "%{http_code}" "http://127.0.0.1:${port}${path}" 2>/dev/null || echo "000")
  if [[ "$code" =~ ^[23] ]]; then
    echo "${name} (${port}): up"
  else
    echo "${name} (${port}): down"
  fi
}

cmd="${1:-start}"

case "$cmd" in
  stop)
    stop_all
    exit 0
    ;;
  status)
    check_status "frontend" 3030 "/"
    check_status "research" 8001
    check_status "scripting" 8002
    check_status "media" 8003
    check_status "seo" 8004
    exit 0
    ;;
  start)
    ;;
  *)
    echo "Usage: ./dev.sh [start|stop|status]"
    exit 1
    ;;
esac

echo "=== Creator Copilot Dev Stack ==="

if ! redis-cli ping &>/dev/null; then
  echo "Error: Redis is not running on localhost:6379."
  echo "Please start redis-server and try again."
  exit 1
fi
echo "Redis server detected."

if [ ! -d "$SERVICES_DIR/venv" ]; then
  echo "Creating virtual environment..."
  python3 -m venv "$SERVICES_DIR/venv"
fi

echo "Activating virtual environment..."
# shellcheck disable=SC1091
source "$SERVICES_DIR/venv/bin/activate"

echo "Installing / updating backend dependencies..."
pip install -q --upgrade pip
pip install -q -r "$SERVICES_DIR/requirements.txt"

cd "$SERVICES_DIR"
export TIKTOK_HEADLESS="${TIKTOK_HEADLESS:-false}"

echo ""
echo "Launching backend (detached — safe to close this terminal)..."
start_service "research" 8001 "research.main:app"
start_service "scripting" 8002 "scripting.main:app"
start_service "media" 8003 "media.main:app"
start_service "seo" 8004 "seo.main:app"

if [ ! -f "$PID_DIR/celery.pid" ] || ! kill -0 "$(cat "$PID_DIR/celery.pid")" 2>/dev/null; then
  screen -S cc-celery -X quit 2>/dev/null || true
  screen -dmS cc-celery bash -c "cd '$SERVICES_DIR' && source venv/bin/activate && exec python -m video-worker.worker >> /tmp/cc-celery-worker.log 2>&1"
  sleep 1
  celery_pid=$(pgrep -f 'video-worker.worker' | head -1 || true)
  if [ -n "$celery_pid" ]; then
    echo "$celery_pid" > "$PID_DIR/celery.pid"
    echo "-> Celery worker started (screen:cc-celery, pid ${celery_pid}, log: /tmp/cc-celery-worker.log)"
  else
    echo "-> WARNING: Celery worker failed to start — check /tmp/cc-celery-worker.log"
  fi
else
  echo "-> Celery worker already running (pid $(cat "$PID_DIR/celery.pid"))"
fi

echo ""
echo "Launching frontend..."
start_frontend || true

echo ""
echo "Waiting for services..."
wait_for_port 8001 "research" "/docs" 45 || true
wait_for_port 8002 "scripting" "/docs" 30 || true
wait_for_port 8003 "media" "/docs" 20 || true
wait_for_port 8004 "seo" "/docs" 20 || true
wait_for_port 3030 "frontend" "/" 90 || true

echo ""
echo "Done. Full stack keeps running after this script exits."
echo "  App:     http://localhost:3030"
echo "  Status:  ./dev.sh status"
echo "  Stop:    ./dev.sh stop"
echo "  Logs:    /tmp/cc-frontend.log, /tmp/cc-research.log, ..."
