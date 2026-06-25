#!/bin/bash

# Exit on error
set -e

# Directory settings
SCRIPT_DIR="$( cd "$( dirname "${BASH_SOURCE[0]}" )" && pwd )"
SERVICES_DIR="$SCRIPT_DIR/services"

echo "=== Creator Copilot Services Bootstrapper ==="

# Check Redis
if ! redis-cli ping &>/dev/null; then
  echo "Error: Redis is not running on localhost:6379."
  echo "Please start redis-server and try again."
  exit 1
fi
echo "Redis server detected."

# Setup Venv
if [ ! -d "$SERVICES_DIR/venv" ]; then
  echo "Creating virtual environment..."
  python3 -m venv "$SERVICES_DIR/venv"
fi

echo "Activating virtual environment..."
source "$SERVICES_DIR/venv/bin/activate"

echo "Installing / updating dependencies..."
pip install --upgrade pip
pip install -r "$SERVICES_DIR/requirements.txt"

# Kill existing services running on target ports just in case
echo "Cleaning up any stale processes on ports 8001-8004..."
for port in 8001 8002 8003 8004; do
  pid=$(lsof -t -i :$port || true)
  if [ -n "$pid" ]; then
    echo "Killing process $pid on port $port"
    kill -9 $pid || true
  fi
done

# Kill stale Celery workers
pkill -f "video-worker.worker" || true
pkill -f "celery" || true

# Trap shutdown signals to terminate background processes
pids=()
cleanup() {
  echo ""
  echo "Shutting down all microservices and workers..."
  for pid in "${pids[@]}"; do
    kill "$pid" 2>/dev/null || true
  done
  exit 0
}
trap cleanup SIGINT SIGTERM EXIT

echo "Launching microservices..."

# Launch each microservice
cd "$SERVICES_DIR"

export TIKTOK_HEADLESS="${TIKTOK_HEADLESS:-false}"
python -m uvicorn research.main:app --host 127.0.0.1 --port 8001 > /tmp/cc-research.log 2>&1 &
pids+=($!)
echo "-> Research Service started on port 8001 (log: /tmp/cc-research.log)"

python -m uvicorn scripting.main:app --host 127.0.0.1 --port 8002 > /tmp/cc-scripting.log 2>&1 &
pids+=($!)
echo "-> Scripting Service started on port 8002 (log: /tmp/cc-scripting.log)"

python -m uvicorn media.main:app --host 127.0.0.1 --port 8003 > /tmp/cc-media.log 2>&1 &
pids+=($!)
echo "-> Media Service started on port 8003 (log: /tmp/cc-media.log)"

python -m uvicorn seo.main:app --host 127.0.0.1 --port 8004 > /tmp/cc-seo.log 2>&1 &
pids+=($!)
echo "-> SEO Service started on port 8004 (log: /tmp/cc-seo.log)"

# Launch Celery worker
python -m video-worker.worker > /tmp/cc-celery-worker.log 2>&1 &
pids+=($!)
echo "-> Celery Video Worker started (log: /tmp/cc-celery-worker.log)"

echo "All services launched! Press Ctrl+C to terminate."

# Wait for background processes to keep shell open
wait
