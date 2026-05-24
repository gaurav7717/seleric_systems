#!/usr/bin/env bash
# start.sh — Start all local development services (macOS / Linux)
# Usage: bash start.sh
#        bash start.sh --skip-docker
#        bash start.sh --skip-orchestrator

set -euo pipefail

ROOT="$(cd "$(dirname "${BASH_SOURCE[0]}")" && pwd)"
cd "$ROOT"

SKIP_DOCKER=0
SKIP_ORCHESTRATOR=0

for arg in "$@"; do
  case "$arg" in
    --skip-docker) SKIP_DOCKER=1 ;;
    --skip-orchestrator) SKIP_ORCHESTRATOR=1 ;;
  esac
done

step() { echo -e "\n\033[0;32m▶ $1\033[0m"; }
warn() { echo -e "\033[1;33m⚠ $1\033[0m"; }

step "Multi-Agent System — local dev startup"

# ── Environment file ───────────────────────────────────────
if [ ! -f .env.local ]; then
  if [ -f .env.example ]; then
    cp .env.example .env.local
    warn "Created .env.local from .env.example — add your API keys before using external services."
  else
    warn ".env.local not found — some services may fail without env vars."
  fi
fi

# ── Infrastructure (Postgres + Redis) ─────────────────────
if [ "$SKIP_DOCKER" -eq 0 ]; then
  step "Starting Postgres + Redis (Docker)..."
  docker compose up -d postgres redis

  echo "  Waiting for Postgres..."
  for _ in $(seq 1 30); do
    if docker compose exec -T postgres pg_isready -U multiagent >/dev/null 2>&1; then
      echo "  Postgres ready"
      break
    fi
    sleep 2
  done
else
  warn "Skipping Docker infrastructure (--skip-docker)"
fi

# ── Python orchestrator (background) ────────────────────
ORCH_PID=""
if [ "$SKIP_ORCHESTRATOR" -eq 0 ]; then
  step "Starting orchestrator (background, port 8000)..."

  export PYTHONPATH="$ROOT/services/orchestrator:$ROOT/services:$ROOT"
  export ENVIRONMENT=development

  cd "$ROOT/services/orchestrator"
  if command -v uv >/dev/null 2>&1; then
    uv run uvicorn src.main:app --host 0.0.0.0 --port 8000 --reload &
  else
    python3 -m uvicorn src.main:app --host 0.0.0.0 --port 8000 --reload &
  fi
  ORCH_PID=$!
  cd "$ROOT"

  trap 'kill "$ORCH_PID" 2>/dev/null || true' EXIT INT TERM
else
  warn "Skipping orchestrator (--skip-orchestrator)"
fi

# ── Node services (web, worker, mcp-shopify via Turbo) ────
step "Starting Node services (web :3000, worker, mcp-shopify :3100)..."
echo ""
echo "  Web UI:         http://localhost:3000"
echo "  Orchestrator:   http://localhost:8000/docs"
echo "  MCP Shopify:    http://localhost:3100"
echo ""
echo "Press Ctrl+C to stop all services."
echo ""

pnpm dev
