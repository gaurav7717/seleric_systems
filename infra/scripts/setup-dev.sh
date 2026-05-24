#!/usr/bin/env bash
# infra/scripts/setup-dev.sh
# One-command local development environment setup.
# Run: bash infra/scripts/setup-dev.sh

set -euo pipefail

GREEN='\033[0;32m'
YELLOW='\033[1;33m'
RED='\033[0;31m'
NC='\033[0m'

step() { echo -e "${GREEN}▶ $1${NC}"; }
warn() { echo -e "${YELLOW}⚠ $1${NC}"; }
fail() { echo -e "${RED}✗ $1${NC}"; exit 1; }

step "Checking prerequisites..."
command -v node >/dev/null || fail "Node.js >= 20 required. Install from https://nodejs.org"
command -v pnpm >/dev/null || fail "pnpm required. Run: npm install -g pnpm"
command -v python3 >/dev/null || fail "Python 3.12+ required."
command -v docker >/dev/null || fail "Docker required. Install from https://docker.com"
command -v uv >/dev/null || warn "uv not found — using pip instead. Install uv: curl -LsSf https://astral.sh/uv/install.sh | sh"

echo "  Node: $(node --version)"
echo "  pnpm: $(pnpm --version)"
echo "  Python: $(python3 --version)"
echo ""

step "Setting up environment file..."
if [ ! -f .env.local ]; then
  cp .env.example .env.local
  warn "Created .env.local from .env.example — fill in your API keys before running services!"
else
  echo "  .env.local already exists — skipping"
fi

step "Installing Node.js dependencies..."
pnpm install

step "Starting infrastructure (Postgres + Redis)..."
docker compose up -d postgres redis

step "Waiting for Postgres to be ready..."
until docker compose exec -T postgres pg_isready -U multiagent >/dev/null 2>&1; do
  echo "  Waiting for Postgres..."
  sleep 2
done
echo "  Postgres ready"

step "Running database migrations..."
pnpm db:generate
pnpm --filter @multiagent/db migrate:dev --name init || true

step "Setting up Python orchestrator..."
cd services/orchestrator
if command -v uv >/dev/null; then
  uv sync
else
  python3 -m pip install -e ".[dev]"
fi
cd ../..

step "Seeding test data (optional)..."
read -p "  Seed test data into Postgres? (y/N): " seed
if [[ "$seed" =~ ^[Yy]$ ]]; then
  bash infra/scripts/seed-test-data.sh
fi

echo ""
echo -e "${GREEN}✓ Setup complete!${NC}"
echo ""
echo "Next steps:"
echo "  1. Fill in .env.local with your API keys (Anthropic, Pipeboard, Shopify, etc.)"
echo "  2. Run: pnpm dev        (starts all services with hot-reload)"
echo "  3. Open: http://localhost:3000"
echo ""
echo "Individual services:"
echo "  Web:          http://localhost:3000"
echo "  Orchestrator: http://localhost:8000/docs"
echo "  MCP Shopify:  http://localhost:3100"
echo "  Redis GUI:    docker compose --profile tools up -d redis-insight"
echo "  PgAdmin:      docker compose --profile tools up -d pgadmin"
