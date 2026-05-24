# Data Flow

## 1. Signal Ingestion Flow (every 15 minutes)

```
Signal Scanner (YAML rule engine)
│
├── Reads: ClickHouse ad_spend, orders, sessions
├── Reads: Shopify inventory webhooks (real-time cache)
├── Evaluates: rule registry conditions (e.g. ROAS < 1.5 for > 2h)
│
├── IF condition met:
│   ├── Writes to: signals_log table (signal_id, entity_type, entity_id,
│   │            signal_type, context_snapshot, fired_at)
│   └── POST /signal to Orchestrator API
│       Body: { signal_id, entity_type, entity_id, signal_type, context_snapshot }
│
└── IF no condition: exits cleanly, next run in 15 min
```

## 2. Orchestrator Context Assembly Flow

```
POST /signal received
│
├── LangGraph node: validate_signal
│   └── Validates schema, deduplicates (skip if same signal fired < 30 min ago)
│
├── LangGraph node: assemble_context
│   │
│   ├── Redis lookup: entity:{type}:{id}:session
│   │   └── Returns: recent signal history, last insight, last action for this entity
│   │
│   ├── pgvector search: top-5 similar past situations
│   │   └── Embedding query on context_snapshot JSON
│   │   └── Returns: similar InsightCards + their outcomes
│   │
│   ├── Cube API (via Seleric MCP): entity metrics
│   │   └── Fetches: ROAS/CAC/AOV/spend/revenue for 7d + 30d + delta
│   │   └── Cached in Redis for 5 min (cache:cube:{hash})
│   │
│   └── Prompt builder: assembles Jinja2 template with all context
│       └── Token budget: 8000 tokens max
│           Priority if over budget: metrics > session > similar_insights
│
├── LangGraph node: route_agents
│   └── Maps signal_type → agent list (see SIGNAL_AGENT_MAP in orchestrator rules)
│
└── LangGraph node: run_agents (parallel where possible)
    └── Calls insight_agent + specialist_agent concurrently
```

## 3. Agent Execution Flow

```
Agent.run(context) called
│
├── Constructs messages: [{ role: "user", content: assembled_prompt }]
│
├── Claude API call with tools enabled
│   │
│   └── Tool use loop:
│       ├── Claude requests tool call (e.g. clickhouse_query)
│       ├── Tool executes: validates → runs → formats result
│       ├── Tool result appended to messages
│       └── Loop continues until stop_reason = "end_turn"
│
├── parse_response():
│   ├── Extracts InsightCard JSON from response
│   └── Extracts list[ActionProposal] from response
│
└── Returns AgentResult:
    { insight, action_proposals, tool_calls_log, latency_ms, tokens_used }
```

## 4. Guardrail Classification Flow

```
GuardrailAgent.run(all_proposals)
│
├── Loads rules from config/rules.yaml
│
├── For each ActionProposal:
│   ├── Checks hard BLOCK rules (no rationale, >50% budget change)
│   ├── Checks AUTO rules (small budget change, pause below threshold)
│   └── Default: QUEUE (founder reviews)
│
├── Returns GuardrailResult[] with classification per proposal
│
└── Orchestrator splits:
    ├── AUTO → enqueue to execute-action BullMQ queue immediately
    ├── QUEUE → insert to PendingAction table + enqueue send-notification
    └── BLOCK → log to audit table, no further action
```

## 5. Execution Flow (AUTO actions)

```
BullMQ execute-action job dequeued
│
├── Loads PendingAction from Postgres (validates status = APPROVED or classification = AUTO)
├── Selects executor based on action_type:
│   ├── pause_campaign → Pipeboard MCP: update_campaign(status: "PAUSED")
│   ├── shift_budget → Pipeboard MCP: update_adset(daily_budget: new_value)
│   ├── flag_product → Shopify MCP: update_product(tags: [..., "flagged"])
│   └── (others added as Phase 3 expands)
│
├── Executes action via MCP tool call
├── Updates PendingAction: status=EXECUTED, executedAt, executionResult
├── Writes to Redis: signal:{id}:status = "executed"
│
└── Enqueues record-outcome job (runs at T+24h, T+48h, T+7d)
```

## 6. Approval Flow (QUEUE actions)

```
PendingAction inserted (status=PENDING)
│
├── send-notification job:
│   ├── Formats action card: agent / what / why / expected outcome / risk
│   ├── Sends Slack message with approve/reject buttons (signed URL)
│   └── Sends email with same content
│
├── Founder opens control panel OR clicks Slack link
│   ├── Views full context (signal → insight → proposed action)
│   ├── Clicks Approve:
│   │   └── POST /api/approvals/{id} { decision: "approve" }
│   │       └── Validates signed token, updates status=APPROVED
│   │       └── Enqueues execute-action job
│   └── Clicks Reject:
│       └── POST /api/approvals/{id} { decision: "reject", reason }
│           └── Updates status=REJECTED
│
└── IF no decision within 48h:
    └── Cron job sets status=EXPIRED, logs to audit
```

## 7. Outcome Recording Flow

```
record-outcome job runs at T+24h after execution
│
├── Fetches entity metrics from ClickHouse:
│   └── Same metrics as pre-action snapshot (ROAS, spend, revenue, CAC)
│
├── Computes deltas: post_value - pre_value for each metric
│
├── Scores outcome (-1.0 to 1.0):
│   ├── ROAS improved AND spend reduced → positive score
│   ├── ROAS unchanged AND spend reduced → slight positive
│   └── ROAS declined → negative score
│
├── Writes InsightOutcome to Postgres
│
└── Feeds back to signal calibration:
    └── If outcome_score < -0.5:
        POST /signal-calibration/adjust
        Body: { rule_id, signal_type, entity_type, adjustment: "reduce_weight" }
```

## 8. Frontend Data Flow

```
apps/web
│
├── /dashboard (Server Component, ISR revalidate 60s)
│   └── getCubeMetrics() → Seleric MCP → Cube REST → ClickHouse
│
├── /insights (hybrid: Server Component + client WebSocket)
│   ├── Server: initial load of last 50 insights from Postgres
│   └── Client: WebSocket subscription to new insights as signals fire
│
├── /ads (Client Component, SWR 60s refresh)
│   └── GET /api/campaigns → Pipeboard MCP → Meta/Google Ads API
│
├── /shopify (Client Component, SWR 60s refresh)
│   └── GET /api/shopify/products → mcp-shopify → Shopify Admin API
│
├── /chat (Client Component, streaming)
│   └── POST /api/chat → Anthropic API (streaming) with all MCP tools
│   └── Context injected: latest P&L, top 3 signals, active campaigns
│
└── /control (Client Component, SWR 10s refresh)
    └── GET /api/approvals (pending actions from Postgres)
    └── POST /api/approvals/{id} (approve/reject)
    └── GET /api/executions (auto-execute history)
```

## Key Data Schemas

### Signal (fired by rule engine)
```json
{
  "signal_id": "uuid",
  "entity_type": "campaign | adset | product | store",
  "entity_id": "string",
  "signal_type": "roas_drop | spend_spike | revenue_drop | stock_critical | cpa_spike | conversion_drop",
  "context_snapshot": {
    "current_roas": 1.2,
    "roas_7d_avg": 2.1,
    "roas_delta_pct": -42.8,
    "spend_today": 450.00,
    "campaign_name": "Summer Sale - Prospecting",
    "triggered_rule": "roas_below_threshold_2h"
  },
  "fired_at": "ISO8601"
}
```

### InsightCard
```json
{
  "insight_id": "uuid",
  "signal_id": "uuid",
  "severity": "critical | warning | info",
  "title": "Campaign ROAS dropped 43% — Summer Sale Prospecting",
  "what": "ROAS fell from 2.1 to 1.2 over the last 4 hours, with $450 spent today.",
  "why": "CPM increased 38% while conversion rate held flat, suggesting audience fatigue or increased auction competition.",
  "evidence": [
    "CPM: $12.40 → $17.10 (+38%) since 10am",
    "CTR unchanged at 1.8%",
    "Conversion rate: 2.1% (stable vs 7d avg)",
    "Top competitor accounts increased spend by ~$15k this morning (auction signal)"
  ],
  "confidence": 0.78,
  "agent": "insight_agent",
  "created_at": "ISO8601"
}
```

### ActionProposal
```json
{
  "proposal_id": "uuid",
  "signal_id": "uuid",
  "agent": "meta_agent",
  "action_type": "shift_budget",
  "action_payload": {
    "adset_id": "120212345678",
    "current_daily_budget": 200.00,
    "new_daily_budget": 160.00,
    "platform": "meta"
  },
  "rationale": "Reduce budget on Summer Sale Prospecting adset by 20% while ROAS is below 1.5. Reallocate to Retargeting adset currently at ROAS 3.2.",
  "expected_outcome": "Preserve budget for higher-converting traffic. Expected blended ROAS improvement of 0.3-0.5 over 48h.",
  "confidence": 0.72,
  "risk_level": "low",
  "requires_approval": false,
  "classification": "AUTO"
}
```
