#!/usr/bin/env bash
# Phase 2 gate validation — tests all 4 criteria against live services
# Prerequisites:
#   docker compose up -d postgres redis
#   pnpm --filter @multiagent/db migrate:dev
#   orchestrator running on :8000 (AGENT_STUB_MODE=false, LLM_MODEL set)
# Usage: bash infra/scripts/test-phase2.sh

set -euo pipefail

GREEN='\033[0;32m'
RED='\033[0;31m'
YELLOW='\033[0;33m'
NC='\033[0m'

PASS=0
FAIL=0

ok()   { echo -e "  ${GREEN}✓${NC} $1"; ((PASS++)) || true; }
fail() { echo -e "  ${RED}✗${NC} $1"; ((FAIL++)) || true; }
info() { echo -e "  ${YELLOW}→${NC} $1"; }

SCRIPT_DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")" && pwd)"
REPO_ROOT="$(cd "$SCRIPT_DIR/../.." && pwd)"
ORCH_DIR="$REPO_ROOT/services/orchestrator"
AGENTS_DIR="$REPO_ROOT/services/agents"

SIG_ID_BASE="p2-gate-$(date +%s)"

# ── Gate 1: Insight Agent produces InsightCard with evidence ──────────────────
echo ""
echo "Gate 1: Insight Agent — InsightCard with evidence"

SIG_INSIGHT="${SIG_ID_BASE}-insight"

R=$(curl -sf -X POST http://localhost:8000/signal \
  -H "Content-Type: application/json" \
  -d "{
    \"signal_id\":\"$SIG_INSIGHT\",
    \"entity_type\":\"campaign\",
    \"entity_id\":\"camp-p2-001\",
    \"signal_type\":\"roas_drop\",
    \"context_snapshot\":{\"roas_7d\":0.8,\"roas_30d\":1.9,\"spend_7d\":4500,\"cpa_7d\":85}
  }" 2>/dev/null || echo "ERROR")

if echo "$R" | grep -q "accepted"; then
  ok "POST /signal returned accepted"
else
  fail "POST /signal failed: $R"
fi

sleep 5

EVIDENCE=$(docker compose exec -T postgres psql -U multiagent -t -c \
  "SELECT array_length(evidence, 1) FROM \"Insight\" WHERE \"signalId\"='$SIG_INSIGHT' LIMIT 1" \
  2>/dev/null | tr -d ' \n')

if [ -n "${EVIDENCE:-}" ] && [ "${EVIDENCE:-0}" -gt 0 ] 2>/dev/null; then
  ok "InsightCard has evidence array (length=$EVIDENCE)"
else
  # Check if insight exists at all without evidence
  COUNT=$(docker compose exec -T postgres psql -U multiagent -t -c \
    "SELECT COUNT(*) FROM \"Insight\" WHERE \"signalId\"='$SIG_INSIGHT'" 2>/dev/null | tr -d ' \n')
  if [ "${COUNT:-0}" -gt 0 ] 2>/dev/null; then
    fail "InsightCard exists but evidence is empty (AGENT_STUB_MODE may still be true)"
  else
    fail "InsightCard not found for signalId=$SIG_INSIGHT"
  fi
fi

# ── Gate 2: Meta Agent produces ActionProposal with expected outcome ──────────
echo ""
echo "Gate 2: Meta Agent — ActionProposal with expected outcome"

SIG_META="${SIG_ID_BASE}-meta"

R=$(curl -sf -X POST http://localhost:8000/signal \
  -H "Content-Type: application/json" \
  -d "{
    \"signal_id\":\"$SIG_META\",
    \"entity_type\":\"campaign\",
    \"entity_id\":\"camp-p2-002\",
    \"signal_type\":\"roas_drop\",
    \"context_snapshot\":{\"roas_7d\":0.7,\"spend_7d\":6000,\"cpa_7d\":120,\"budget_daily\":300}
  }" 2>/dev/null || echo "ERROR")

if echo "$R" | grep -q "accepted"; then
  info "POST /signal accepted (meta)"
else
  fail "POST /signal failed for meta gate: $R"
fi

sleep 5

META_ACTION=$(docker compose exec -T postgres psql -U multiagent -t -c \
  "SELECT COUNT(*) FROM \"PendingAction\" WHERE \"signalId\"='$SIG_META' AND agent='meta_agent'" \
  2>/dev/null | tr -d ' \n')

if [ "${META_ACTION:-0}" -gt 0 ] 2>/dev/null; then
  ok "Meta Agent produced PendingAction(s) (count=$META_ACTION)"

  # Check expectedOutcome is non-empty
  OUTCOME=$(docker compose exec -T postgres psql -U multiagent -t -c \
    "SELECT \"expectedOutcome\" FROM \"PendingAction\" WHERE \"signalId\"='$SIG_META' AND agent='meta_agent' LIMIT 1" \
    2>/dev/null | tr -d '\n' | xargs)

  if [ -n "${OUTCOME:-}" ] && [ "${OUTCOME}" != "" ]; then
    ok "Meta ActionProposal has expected_outcome: \"${OUTCOME:0:60}...\""
  else
    fail "Meta ActionProposal missing expected_outcome"
  fi
else
  fail "No PendingAction from meta_agent for signalId=$SIG_META (check AGENT_STUB_MODE and LLM_MODEL)"
fi

# ── Gate 3: Shopify Agent produces product velocity analysis ──────────────────
echo ""
echo "Gate 3: Shopify Agent — product velocity analysis"

SIG_SHOPIFY="${SIG_ID_BASE}-shopify"

R=$(curl -sf -X POST http://localhost:8000/signal \
  -H "Content-Type: application/json" \
  -d "{
    \"signal_id\":\"$SIG_SHOPIFY\",
    \"entity_type\":\"product\",
    \"entity_id\":\"prod-p2-001\",
    \"signal_type\":\"stock_critical\",
    \"context_snapshot\":{\"stock_units\":8,\"units_sold_7d\":42,\"days_remaining\":1.3,\"revenue_7d\":2100}
  }" 2>/dev/null || echo "ERROR")

if echo "$R" | grep -q "accepted"; then
  info "POST /signal accepted (shopify)"
else
  fail "POST /signal failed for shopify gate: $R"
fi

sleep 5

SHOPIFY_ACTION=$(docker compose exec -T postgres psql -U multiagent -t -c \
  "SELECT COUNT(*) FROM \"PendingAction\" WHERE \"signalId\"='$SIG_SHOPIFY' AND agent='shopify_agent'" \
  2>/dev/null | tr -d ' \n')

if [ "${SHOPIFY_ACTION:-0}" -gt 0 ] 2>/dev/null; then
  ok "Shopify Agent produced PendingAction(s) (count=$SHOPIFY_ACTION)"

  RATIONALE=$(docker compose exec -T postgres psql -U multiagent -t -c \
    "SELECT rationale FROM \"PendingAction\" WHERE \"signalId\"='$SIG_SHOPIFY' AND agent='shopify_agent' LIMIT 1" \
    2>/dev/null | tr -d '\n' | xargs)

  if [ -n "${RATIONALE:-}" ] && [ "${#RATIONALE}" -gt 20 ]; then
    ok "Shopify ActionProposal has velocity rationale: \"${RATIONALE:0:80}...\""
  else
    fail "Shopify ActionProposal rationale missing or too short"
  fi
else
  fail "No PendingAction from shopify_agent for signalId=$SIG_SHOPIFY (check AGENT_STUB_MODE and LLM_MODEL)"
fi

# ── Gate 4: Guardrail classifies 1 AUTO, 1 QUEUE, 1 BLOCK ────────────────────
echo ""
echo "Gate 4: Guardrail classification (1 AUTO, 1 QUEUE, 1 BLOCK)"

GUARD_RESULT=$(PYTHONPATH="$ORCH_DIR:$AGENTS_DIR" python3 -c "
import asyncio, json
from agents.guardrail.src.classifier import classify_proposal
from agents.guardrail.src.rules_loader import load_rules

import os
os.chdir('$REPO_ROOT')

rules = load_rules()

proposals = [
    {
        'proposal_id': 'test-auto-1',
        'signal_id': 'test',
        'entity_type': 'adset',
        'entity_id': 'adset-001',
        'agent': 'meta_agent',
        'action_type': 'shift_budget',
        'action_payload': {'budget_delta_pct': -5},
        'rationale': 'ROAS dropped from 2.1 to 0.8 over 7 days, CPA is 120 vs target 50',
        'expected_outcome': 'Reduce wasted spend by 5%, saving ~150 USD/week',
        'confidence': 0.90,
        'risk_level': 'low',
        'requires_approval': False,
    },
    {
        'proposal_id': 'test-queue-1',
        'signal_id': 'test',
        'entity_type': 'campaign',
        'entity_id': 'camp-001',
        'agent': 'meta_agent',
        'action_type': 'shift_budget',
        'action_payload': {'budget_delta_pct': -25},
        'rationale': 'Campaign ROAS at 0.7 for 3 days, spend is 6000 USD/week significantly above target',
        'expected_outcome': 'Reduce spend by 25% to 4500 USD/week while maintaining reach',
        'confidence': 0.72,
        'risk_level': 'medium',
        'requires_approval': True,
    },
    {
        'proposal_id': 'test-block-1',
        'signal_id': 'test',
        'entity_type': 'campaign',
        'entity_id': 'camp-002',
        'agent': 'meta_agent',
        'action_type': 'shift_budget',
        'action_payload': {'budget_delta_pct': -80},
        'rationale': 'Pause',
        'expected_outcome': 'Stop spend',
        'confidence': 0.85,
        'risk_level': 'low',
        'requires_approval': False,
    },
]

results = [classify_proposal(p, rules) for p in proposals]
classifications = [r['classification'] for r in results]
rules_matched = [r.get('guardrail_rule', 'unknown') for r in results]
print(json.dumps({'classifications': classifications, 'rules': rules_matched}))
" 2>&1 || echo "ERROR")

if echo "$GUARD_RESULT" | python3 -c "
import sys, json
data = json.load(sys.stdin)
c = data['classifications']
assert 'AUTO' in c, f'No AUTO: {c}'
assert 'QUEUE' in c, f'No QUEUE: {c}'
assert 'BLOCK' in c, f'No BLOCK: {c}'
print('ok')
" 2>/dev/null | grep -q ok; then
  CLASSES=$(echo "$GUARD_RESULT" | python3 -c "import sys,json; d=json.load(sys.stdin); print(' | '.join(f\"{d['classifications'][i]} ({d['rules'][i]})\" for i in range(3)))" 2>/dev/null)
  ok "Guardrail: $CLASSES"
else
  fail "Guardrail classification failed: $GUARD_RESULT"
fi

# ── Summary ───────────────────────────────────────────────────────────────────
echo ""
echo "────────────────────────────────"
echo "Results: $PASS passed, $FAIL failed"
if [ "$FAIL" -eq 0 ]; then
  echo -e "${GREEN}✓ Phase 2 gate criteria MET${NC}"
else
  echo -e "${RED}✗ Phase 2 NOT complete — $FAIL check(s) failed${NC}"
  echo ""
  echo "Common fixes:"
  echo "  - Set AGENT_STUB_MODE=false in .env"
  echo "  - Set LLM_MODEL=claude-sonnet-4-20250514 or similar in .env"
  echo "  - Ensure ANTHROPIC_API_KEY is set"
  echo "  - Restart orchestrator after .env changes"
  exit 1
fi
