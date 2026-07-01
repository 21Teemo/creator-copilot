#!/bin/bash

# Creator Copilot dev stack — detached screen sessions with auto-restart on crash.
# Usage: ./dev.sh [start|stop|status|ensure|watch|restart <service>]

SCRIPT_DIR="$( cd "$( dirname "${BASH_SOURCE[0]}" )" && pwd )"
SERVICES_DIR="$SCRIPT_DIR/services"
FRONTEND_DIR="$SCRIPT_DIR/frontend"
PID_DIR="/tmp/creator-copilot-pids"
WATCHDOG_SCREEN="cc-watchdog"
RESTART_DELAY="${CC_RESTART_DELAY:-3}"
WATCH_INTERVAL="${CC_WATCH_INTERVAL:-15}"

mkdir -p "$PID_DIR"

service_port() {
  case "$1" in
    research) echo 8001 ;;
    scripting) echo 8002 ;;
    media) echo 8003 ;;
    seo) echo 8004 ;;
    frontend) echo 3030 ;;
    *) echo "" ;;
  esac
}

service_module() {
  case "$1" in
    research) echo "research.main:app" ;;
    scripting) echo "scripting.main:app" ;;
    media) echo "media.main:app" ;;
    seo) echo "seo.main:app" ;;
    *) echo "" ;;
  esac
}

port_is_up() {
  local port="$1"
  local path="${2:-/docs}"
  local code
  code=$(curl -s -o /dev/null -w "%{http_code}" "http://127.0.0.1:${port}${path}" 2>/dev/null || echo "000")
  [[ "$code" =~ ^[23] ]]
}

start_service() {
  local name="$1"
  local port="$2"
  local module="$3"
  local pidfile="$PID_DIR/${name}.pid"
  local logfile="/tmp/cc-${name}.log"
  local screen_name="cc-${name}"

  if port_is_up "$port"; then
    local existing
    existing=$(lsof -t -i :"$port" 2>/dev/null | head -1 || true)
    echo "-> ${name} already listening on port ${port}${existing:+ (pid ${existing})}"
    [ -n "$existing" ] && echo "$existing" > "$pidfile"
    return 0
  fi

  screen -S "$screen_name" -X quit 2>/dev/null || true
  # Restart loop inside screen — survives agent terminal exit and recovers from crashes.
  screen -dmS "$screen_name" bash -c "
    cd '$SERVICES_DIR' || exit 1
    source venv/bin/activate
    while true; do
      echo \"[\$(date '+%Y-%m-%dT%H:%M:%S')] starting ${name} on port ${port}\" >> '$logfile'
      python -m uvicorn '${module}' --host 127.0.0.1 --port '${port}' >> '$logfile' 2>&1
      echo \"[\$(date '+%Y-%m-%dT%H:%M:%S')] ${name} exited — restarting in ${RESTART_DELAY}s\" >> '$logfile'
      sleep ${RESTART_DELAY}
    done
  "
  sleep 1
  local existing=""
  for ((i = 0; i < 25; i++)); do
    existing=$(lsof -t -i :"$port" 2>/dev/null | head -1 || true)
    if [ -n "$existing" ]; then
      break
    fi
    sleep 1
  done
  if [ -n "$existing" ]; then
    echo "$existing" > "$pidfile"
    echo "-> ${name} started on port ${port} (screen:${screen_name}, pid ${existing}, log: ${logfile})"
  else
    echo "-> WARNING: ${name} failed to bind port ${port} — check ${logfile}"
    return 1
  fi
}

start_frontend() {
  local port=3030
  local pidfile="$PID_DIR/frontend.pid"
  local logfile="/tmp/cc-frontend.log"
  local screen_name="cc-frontend"

  if ! command -v npm &>/dev/null; then
    echo "WARNING: npm not found — skipping frontend. Install Node.js to run the UI."
    return 1
  fi

  if port_is_up "$port" "/"; then
    local existing
    existing=$(lsof -t -i :"$port" 2>/dev/null | head -1 || true)
    echo "-> frontend already listening on port ${port}${existing:+ (pid ${existing})}"
    [ -n "$existing" ] && echo "$existing" > "$pidfile"
    return 0
  fi

  if [ ! -d "$FRONTEND_DIR/node_modules" ]; then
    echo "Installing frontend dependencies (first run)..."
    (cd "$FRONTEND_DIR" && npm install --silent)
  fi

  screen -S "$screen_name" -X quit 2>/dev/null || true
  screen -dmS "$screen_name" bash -c "
    while true; do
      echo \"[\$(date '+%Y-%m-%dT%H:%M:%S')] starting frontend on port ${port}\" >> '$logfile'
      npm run dev --prefix '$FRONTEND_DIR' >> '$logfile' 2>&1
      echo \"[\$(date '+%Y-%m-%dT%H:%M:%S')] frontend exited — restarting in ${RESTART_DELAY}s\" >> '$logfile'
      sleep ${RESTART_DELAY}
    done
  "
  sleep 2
  local existing=""
  for ((i = 0; i < 45; i++)); do
    if port_is_up "$port" "/"; then
      existing=$(lsof -t -i :"$port" 2>/dev/null | head -1 || true)
      break
    fi
    sleep 2
  done
  if [ -n "$existing" ]; then
    echo "$existing" > "$pidfile"
    echo "-> frontend started on port ${port} (screen:${screen_name}, pid ${existing}, log: ${logfile})"
  else
    echo "-> WARNING: frontend failed to bind port ${port} — check ${logfile}"
    return 1
  fi
}

start_celery() {
  if pgrep -f 'video-worker.worker' >/dev/null 2>&1; then
    local celery_pid
    celery_pid=$(pgrep -f 'video-worker.worker' | head -1)
    echo "$celery_pid" > "$PID_DIR/celery.pid"
    echo "-> Celery worker already running (pid ${celery_pid})"
    return 0
  fi

  screen -S cc-celery -X quit 2>/dev/null || true
  screen -dmS cc-celery bash -c "
    cd '$SERVICES_DIR' || exit 1
    source venv/bin/activate
    while true; do
      echo \"[\$(date '+%Y-%m-%dT%H:%M:%S')] starting celery worker\" >> /tmp/cc-celery-worker.log
      python -m video-worker.worker >> /tmp/cc-celery-worker.log 2>&1
      echo \"[\$(date '+%Y-%m-%dT%H:%M:%S')] celery exited — restarting in ${RESTART_DELAY}s\" >> /tmp/cc-celery-worker.log
      sleep ${RESTART_DELAY}
    done
  "
  sleep 1
  local celery_pid
  celery_pid=$(pgrep -f 'video-worker.worker' | head -1 || true)
  if [ -n "$celery_pid" ]; then
    echo "$celery_pid" > "$PID_DIR/celery.pid"
    echo "-> Celery worker started (screen:cc-celery, pid ${celery_pid}, log: /tmp/cc-celery-worker.log)"
  else
    echo "-> WARNING: Celery worker failed to start — check /tmp/cc-celery-worker.log"
    return 1
  fi
}

stop_service() {
  local name="$1"
  local port="$2"
  local pidfile="$PID_DIR/${name}.pid"
  local screen_name="cc-${name}"

  screen -S "$screen_name" -X quit 2>/dev/null || true

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
    kill $port_pid 2>/dev/null || true
    echo "Stopped process on port ${port}"
  fi
}

stop_all() {
  echo "Stopping Creator Copilot services..."
  screen -S "$WATCHDOG_SCREEN" -X quit 2>/dev/null || true
  stop_service "frontend" 3030
  stop_service "research" 8001
  stop_service "scripting" 8002
  stop_service "media" 8003
  stop_service "seo" 8004
  screen -S cc-celery -X quit 2>/dev/null || true
  pkill -f "video-worker.worker" 2>/dev/null || true
  rm -f "$PID_DIR/celery.pid"
}

restart_one() {
  local name="$1"
  local port module
  port=$(service_port "$name")
  module=$(service_module "$name")

  if [ -z "$port" ]; then
    echo "Unknown service: ${name}"
    echo "Valid: research, scripting, media, seo, frontend, celery, all"
    return 1
  fi

  echo "Restarting ${name}..."
  if [ "$name" = "frontend" ]; then
    stop_service "frontend" 3030
    start_frontend
  elif [ "$name" = "celery" ]; then
    screen -S cc-celery -X quit 2>/dev/null || true
    pkill -f "video-worker.worker" 2>/dev/null || true
    rm -f "$PID_DIR/celery.pid"
    start_celery
  else
    stop_service "$name" "$port"
    start_service "$name" "$port" "$module"
  fi
}

ensure_all() {
  local restarted=0
  for name in research scripting media seo; do
    local port module
    port=$(service_port "$name")
    module=$(service_module "$name")
    if ! port_is_up "$port"; then
      echo "!! ${name} down — restarting"
      start_service "$name" "$port" "$module" || true
      restarted=1
    fi
  done
  if ! pgrep -f 'video-worker.worker' >/dev/null 2>&1; then
    echo "!! celery down — restarting"
    start_celery || true
    restarted=1
  fi
  if ! port_is_up 3030 "/"; then
    echo "!! frontend down — restarting"
    start_frontend || true
    restarted=1
  fi
  if [ "$restarted" -eq 0 ]; then
    echo "All services healthy."
  fi
}

start_watchdog() {
  if screen -ls 2>/dev/null | grep -q "[.]${WATCHDOG_SCREEN}"; then
    echo "Watchdog already running (screen:${WATCHDOG_SCREEN})"
    return 0
  fi
  screen -dmS "$WATCHDOG_SCREEN" bash -c "
    while true; do
      '$SCRIPT_DIR/dev.sh' ensure >> /tmp/cc-watchdog.log 2>&1
      sleep ${WATCH_INTERVAL}
    done
  "
  echo "Watchdog started (screen:${WATCHDOG_SCREEN}, interval ${WATCH_INTERVAL}s, log: /tmp/cc-watchdog.log)"
}

wait_for_port() {
  local port="$1"
  local label="$2"
  local path="${3:-/docs}"
  local tries="${4:-30}"

  for ((i = 1; i <= tries; i++)); do
    if port_is_up "$port" "$path"; then
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

  if port_is_up "$port" "$path"; then
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
    if pgrep -f 'video-worker.worker' >/dev/null 2>&1; then
      echo "celery: up"
    else
      echo "celery: down"
    fi
    if screen -ls 2>/dev/null | grep -q "[.]${WATCHDOG_SCREEN}"; then
      echo "watchdog: up (screen:${WATCHDOG_SCREEN})"
    else
      echo "watchdog: down (run ./dev.sh watch)"
    fi
    exit 0
    ;;
  ensure)
    ensure_all
    exit 0
    ;;
  watch)
    start_watchdog
  ensure_all
    exit 0
    ;;
  restart)
    name="${2:-}"
    if [ -z "$name" ]; then
      echo "Usage: ./dev.sh restart <research|scripting|media|seo|frontend|celery|all>"
      exit 1
    fi
    if [ "$name" = "all" ]; then
      stop_all
      exec "$SCRIPT_DIR/dev.sh" start
    fi
    restart_one "$name"
    exit 0
    ;;
  start)
    ;;
  *)
    echo "Usage: ./dev.sh [start|stop|status|ensure|watch|restart <service>]"
    exit 1
    ;;
esac

set -e

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
echo "Launching backend (detached screen sessions — auto-restart on crash)..."
start_service "research" 8001 "research.main:app" || true
start_service "scripting" 8002 "scripting.main:app" || true
start_service "media" 8003 "media.main:app" || true
start_service "seo" 8004 "seo.main:app" || true
start_celery || true

echo ""
echo "Launching frontend..."
start_frontend || true

start_watchdog

echo ""
echo "Waiting for services..."
wait_for_port 8001 "research" "/docs" 45 || true
wait_for_port 8002 "scripting" "/docs" 30 || true
wait_for_port 8003 "media" "/docs" 20 || true
wait_for_port 8004 "seo" "/docs" 20 || true
wait_for_port 3030 "frontend" "/" 90 || true

echo ""
echo "Done. Stack keeps running after this script exits."
echo "  App:       http://localhost:3030"
echo "  Status:    ./dev.sh status"
echo "  Heal now:  ./dev.sh ensure"
echo "  Watchdog:  ./dev.sh watch   (re-checks every ${WATCH_INTERVAL}s)"
echo "  Restart:   ./dev.sh restart media"
echo "  Stop:      ./dev.sh stop"
echo "  Logs:      /tmp/cc-*.log"
