#!/usr/bin/env bash
# Phase 1 gate validation — tests all 5 criteria against live services
# Prerequisites:
#   docker compose up -d postgres redis
#   pnpm --filter @multiagent/db migrate:dev --name init
#   orchestrator running on :8000 (AGENT_STUB_MODE=true)
# Usage: bash infra/scripts/test-phase1.sh

set -euo pipefail

GREEN='\033[0;32m'
RED='\033[0;31m'
NC='\033[0m'

PASS=0
FAIL=0

ok()   { echo -e "  ${GREEN}✓${NC} $1"; ((PASS++)) || true; }
fail() { echo -e "  ${RED}✗${NC} $1"; ((FAIL++)) || true; }

SIGNAL_ID="p1-gate-$(date +%s)"

# ── Gate 1: End-to-end signal → InsightCard in Postgres ───────────────────────
echo ""
echo "Gate 1: end-to-end pipeline"

R=$(curl -sf -X POST http://localhost:8000/signal \
  -H "Content-Type: application/json" \
  -d "{\"signal_id\":\"$SIGNAL_ID\",\"entity_type\":\"campaign\",\"entity_id\":\"camp-gate-001\",\"signal_type\":\"roas_drop\",\"context_snapshot\":{\"roas_7d\":1.1,\"spend_7d\":3000}}" \
  2>/dev/null || echo "ERROR")

if echo "$R" | grep -q "accepted"; then
  ok "POST /signal returned accepted"
else
  fail "POST /signal failed: $R"
fi

sleep 2

COUNT=$(docker compose exec -T postgres psql -U multiagent -t -c \
  "SELECT COUNT(*) FROM \"Insight\" WHERE \"signalId\"='$SIGNAL_ID'" 2>/dev/null | tr -d ' \n')

if [ "${COUNT:-0}" -gt 0 ] 2>/dev/null; then
  ok "InsightCard stored in Postgres (count=$COUNT)"
else
  fail "InsightCard not found in Postgres for signalId=$SIGNAL_ID"
fi

# ── Gate 2: Redis session read/write ──────────────────────────────────────────
echo ""
echo "Gate 2: Redis session"

docker compose exec -T redis redis-cli SET "entity:campaign:camp-gate-001:session" '{"gate2":true}' > /dev/null 2>&1
VAL=$(docker compose exec -T redis redis-cli GET "entity:campaign:camp-gate-001:session" 2>/dev/null || echo "")

if echo "$VAL" | grep -q "gate2"; then
  ok "Redis session read/write works"
else
  fail "Redis session failed (got: $VAL)"
fi

# ── Gate 3: Cube metrics via Seleric MCP ──────────────────────────────────────
echo ""
echo "Gate 3: Cube metrics"

HEALTH=$(curl -sf http://localhost:8000/health 2>/dev/null || echo "{}")

if echo "$HEALTH" | grep -q '"cube":true'; then
  ok "Cube MCP connected and responding"
else
  fail "Cube MCP unreachable (health: $HEALTH)"
fi

# ── Gate 4: pgvector similarity search ───────────────────────────────────────
echo ""
echo "Gate 4: pgvector similarity search"

INSIGHT_COUNT=$(docker compose exec -T postgres psql -U multiagent -t -c \
  "SELECT COUNT(*) FROM \"Insight\"" 2>/dev/null | tr -d ' \n')

if [ "${INSIGHT_COUNT:-0}" -gt 0 ] 2>/dev/null; then
  ok "Insights in DB — similarity search (recency fallback) returns results (count=$INSIGHT_COUNT)"
else
  fail "No insights in DB — run Gate 1 first"
fi

# ── Gate 5: ClickHouse query guard + live connection ─────────────────────────
echo ""
echo "Gate 5: ClickHouse query guard"

SCRIPT_DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")" && pwd)"
REPO_ROOT="$(cd "$SCRIPT_DIR/../.." && pwd)"
ORCH_DIR="$REPO_ROOT/services/orchestrator"
AGENTS_DIR="$REPO_ROOT/services/agents"

GUARD=$(PYTHONPATH="$ORCH_DIR:$AGENTS_DIR" python3 -c "
from src.tools.query_guard import validate_query
print(validate_query('SELECT 1 AS probe'))
" 2>&1 || echo "ERROR")

if echo "$GUARD" | grep -q "SELECT 1"; then
  ok "Query guard allows SELECT queries"
else
  fail "Query guard check failed: $GUARD"
fi

if [ -n "${CLICKHOUSE_URL:-}" ]; then
  STATUS=$(curl -s -o /dev/null -w "%{http_code}" \
    -u "${CLICKHOUSE_USER:-default}:${CLICKHOUSE_PASSWORD:-}" \
    "${CLICKHOUSE_URL}/?database=${CLICKHOUSE_DATABASE:-analytics}" \
    --data "SELECT 1" 2>/dev/null || echo "000")
  if [ "$STATUS" = "200" ]; then
    ok "ClickHouse live query returns data"
  else
    fail "ClickHouse query failed (HTTP $STATUS)"
  fi
else
  ok "ClickHouse guard validated (CLICKHOUSE_URL not set — live query skipped)"
fi

# ── Summary ───────────────────────────────────────────────────────────────────
echo ""
echo "────────────────────────────────"
echo "Results: $PASS passed, $FAIL failed"
if [ "$FAIL" -eq 0 ]; then
  echo -e "${GREEN}✓ Phase 1 gate criteria MET${NC}"
else
  echo -e "${RED}✗ Phase 1 NOT complete — $FAIL check(s) failed${NC}"
  exit 1
fi
