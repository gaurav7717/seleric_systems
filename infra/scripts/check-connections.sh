#!/usr/bin/env bash
# infra/scripts/check-connections.sh
# Validates all external service connections before starting dev or deploying.
# Run: bash infra/scripts/check-connections.sh

set -euo pipefail
source .env.local 2>/dev/null || source .env 2>/dev/null || true

GREEN='\033[0;32m'
RED='\033[0;31m'
YELLOW='\033[1;33m'
NC='\033[0m'

ok()   { echo -e "  ${GREEN}✓${NC} $1"; }
fail() { echo -e "  ${RED}✗${NC} $1"; FAILED=1; }
skip() { echo -e "  ${YELLOW}–${NC} $1 (not configured)"; }

FAILED=0

echo ""
echo "Checking connections..."
echo ""

# Anthropic API
echo "Anthropic API"
if [ -n "${ANTHROPIC_API_KEY:-}" ]; then
  STATUS=$(curl -s -o /dev/null -w "%{http_code}" \
    -H "x-api-key: $ANTHROPIC_API_KEY" \
    -H "anthropic-version: 2023-06-01" \
    "https://api.anthropic.com/v1/models" 2>/dev/null || echo "000")
  [ "$STATUS" = "200" ] && ok "Anthropic API reachable" || fail "Anthropic API failed (HTTP $STATUS)"
else
  fail "ANTHROPIC_API_KEY not set"
fi

# ClickHouse
echo ""
echo "ClickHouse"
if [ -n "${CLICKHOUSE_URL:-}" ]; then
  STATUS=$(curl -s -o /dev/null -w "%{http_code}" \
    -u "${CLICKHOUSE_USER:-default}:${CLICKHOUSE_PASSWORD:-}" \
    "${CLICKHOUSE_URL}/ping" 2>/dev/null || echo "000")
  [ "$STATUS" = "200" ] && ok "ClickHouse reachable" || fail "ClickHouse failed (HTTP $STATUS)"
else
  fail "CLICKHOUSE_URL not set"
fi

# Shopify
echo ""
echo "Shopify Admin API"
if [ -n "${SHOPIFY_STORE_DOMAIN:-}" ] && [ -n "${SHOPIFY_ADMIN_ACCESS_TOKEN:-}" ]; then
  STATUS=$(curl -s -o /dev/null -w "%{http_code}" \
    -H "X-Shopify-Access-Token: $SHOPIFY_ADMIN_ACCESS_TOKEN" \
    "https://${SHOPIFY_STORE_DOMAIN}/admin/api/${SHOPIFY_API_VERSION:-2024-10}/shop.json" 2>/dev/null || echo "000")
  [ "$STATUS" = "200" ] && ok "Shopify Admin API reachable" || fail "Shopify API failed (HTTP $STATUS)"
else
  skip "Shopify not configured"
fi

# Pipeboard MCP
echo ""
echo "Pipeboard MCP"
if [ -n "${PIPEBOARD_TOKEN:-}" ]; then
  STATUS=$(curl -s -o /dev/null -w "%{http_code}" \
    -H "Authorization: Bearer $PIPEBOARD_TOKEN" \
    "https://meta-ads.mcp.pipeboard.co/health" 2>/dev/null || echo "000")
  [ "$STATUS" = "200" ] && ok "Pipeboard MCP reachable" || fail "Pipeboard MCP failed (HTTP $STATUS)"
else
  skip "PIPEBOARD_TOKEN not set"
fi

# Seleric MCP
echo ""
echo "Seleric MCP (Cube)"
if [ -n "${SELERIC_API_KEY:-}" ]; then
  STATUS=$(curl -s -o /dev/null -w "%{http_code}" \
    -H "Authorization: Bearer $SELERIC_API_KEY" \
    "${SELERIC_MCP_URL:-https://mcp.seleric.com/sse}" 2>/dev/null || echo "000")
  [ "$STATUS" = "200" ] && ok "Seleric MCP reachable" || fail "Seleric MCP failed (HTTP $STATUS)"
else
  skip "SELERIC_API_KEY not set"
fi

# Postgres (local Docker)
echo ""
echo "Postgres"
if command -v pg_isready >/dev/null 2>&1; then
  pg_isready -h localhost -U multiagent >/dev/null 2>&1 && ok "Postgres reachable (localhost:5432)" || fail "Postgres not reachable"
else
  STATUS=$(docker compose exec -T postgres pg_isready -U multiagent 2>/dev/null && echo "ok" || echo "fail")
  [ "$STATUS" = "ok" ] && ok "Postgres reachable (Docker)" || fail "Postgres not reachable"
fi

# Redis (local Docker)
echo ""
echo "Redis"
STATUS=$(docker compose exec -T redis redis-cli ping 2>/dev/null || echo "fail")
[ "$STATUS" = "PONG" ] && ok "Redis reachable (Docker)" || fail "Redis not reachable"

# Slack webhook
echo ""
echo "Slack"
if [ -n "${SLACK_WEBHOOK_URL:-}" ]; then
  STATUS=$(curl -s -o /dev/null -w "%{http_code}" \
    -X POST -H "Content-type: application/json" \
    -d '{"text":"Connection test from check-connections.sh — ignore this message"}' \
    "$SLACK_WEBHOOK_URL" 2>/dev/null || echo "000")
  [ "$STATUS" = "200" ] && ok "Slack webhook working" || fail "Slack webhook failed (HTTP $STATUS)"
else
  skip "SLACK_WEBHOOK_URL not set"
fi

echo ""
if [ "$FAILED" = "0" ]; then
  echo -e "${GREEN}All checks passed!${NC}"
  exit 0
else
  echo -e "${RED}Some checks failed — fix the above issues before proceeding.${NC}"
  exit 1
fi
