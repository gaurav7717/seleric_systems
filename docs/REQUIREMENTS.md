# Requirements

## Functional Requirements

### FR-01: Signal Processing
- **FR-01.1** The system MUST process fired signals within 30 seconds of receipt
- **FR-01.2** The system MUST deduplicate signals — the same signal for the same entity fired within 30 minutes MUST be ignored
- **FR-01.3** The system MUST support these signal types: `roas_drop`, `spend_spike`, `revenue_drop`, `stock_critical`, `cpa_spike`, `conversion_drop`, `budget_exhausted`, `ltv_decline`, `conversion_rate_drop`
- **FR-01.4** The system MUST log every signal to the signals_log with full context snapshot

### FR-02: Context Assembly
- **FR-02.1** The orchestrator MUST retrieve session memory from Redis before invoking any agent
- **FR-02.2** The orchestrator MUST perform a semantic search for similar past situations (top-5) before prompt construction
- **FR-02.3** The orchestrator MUST fetch current entity metrics from the Cube semantic layer
- **FR-02.4** Assembled context MUST NOT exceed 8,000 tokens to maintain acceptable agent latency

### FR-03: Agent Execution
- **FR-03.1** The Insight Agent MUST produce an InsightCard for every signal processed, regardless of whether an action is proposed
- **FR-03.2** The Meta Agent MUST have access to Pipeboard MCP tools (read in Phase 1–2; write in Phase 3+)
- **FR-03.3** The Shopify Agent MUST have access to Shopify Admin API via the custom MCP server
- **FR-03.4** All agents MUST include confidence scores (0.0–1.0) on all outputs
- **FR-03.5** All agents MUST cite specific data points in their reasoning — no vague assertions
- **FR-03.6** Agent execution MUST be non-blocking — processed via async job queue, not synchronous HTTP

### FR-04: Guardrail Classification
- **FR-04.1** Every ActionProposal MUST pass through the Guardrail agent before any execution or queueing
- **FR-04.2** The Guardrail MUST load rules from `config/rules.yaml` — NOT hardcoded logic
- **FR-04.3** Actions classified as BLOCK MUST be logged to the audit table and NEVER executed
- **FR-04.4** AUTO classification MUST only apply when: budget change ≤ 10% AND spend < $500/day per campaign, OR campaign pause for campaigns with ROAS below threshold for > 48h AND spend < $200/day
- **FR-04.5** The rule thresholds (spend caps, ROAS thresholds, budget change %) MUST be configurable via `config/rules.yaml` without code changes

### FR-05: Auto Execution
- **FR-05.1** AUTO-classified actions MUST be executed within 60 seconds of Guardrail classification
- **FR-05.2** MUST be disabled when `WRITE_ENABLED=false` (default in all environments until Phase 3)
- **FR-05.3** Every execution MUST record: before state, after state, action taken, timestamp, executor
- **FR-05.4** Failed executions MUST retry with exponential backoff (max 3 retries) then alert

### FR-06: Approval Queue
- **FR-06.1** QUEUE-classified actions MUST trigger a Slack notification AND email within 60 seconds
- **FR-06.2** The notification MUST show: agent, signal, proposed action, expected outcome, risk level
- **FR-06.3** Founders MUST be able to approve/reject via: control panel UI, Slack button (signed URL), email link
- **FR-06.4** Pending actions MUST expire after 48 hours if not acted upon — expired actions MUST NOT be executed
- **FR-06.5** Founders MUST be able to modify an action before approving (edit budget delta, for example)

### FR-07: Outcome Tracking
- **FR-07.1** The system MUST measure metric deltas at T+24h, T+48h, and T+7d after every executed action
- **FR-07.2** Outcome scores MUST be stored in the `InsightOutcome` table linked to the originating InsightCard
- **FR-07.3** Poor outcomes (score < -0.5) MUST trigger a signal calibration adjustment via the rule engine
- **FR-07.4** Per-agent accuracy metrics MUST be visible in the control panel

### FR-08: P&L Dashboard
- **FR-08.1** MUST show: daily/weekly/monthly revenue, ad spend, COGS (if available), net margin, MER, ROAS, CAC, AOV
- **FR-08.2** MUST show channel breakdown: Meta, Google, Organic, Direct
- **FR-08.3** Data MUST refresh every 60 seconds during active business hours (6am–midnight local time)
- **FR-08.4** Anomalies highlighted by the signal engine MUST be visible as overlays on trend charts

### FR-09: Insights Dashboard
- **FR-09.1** MUST display InsightCards in real-time as signals fire (WebSocket push)
- **FR-09.2** MUST color-code by severity: critical (red), warning (amber), info (green)
- **FR-09.3** Each InsightCard MUST show: title, what, why, evidence, confidence, agent, age
- **FR-09.4** Founders MUST be able to dismiss, snooze (1h/4h/24h), or escalate insights
- **FR-09.5** Historical insights with outcome annotations MUST be accessible (last 90 days)

### FR-10: Chat Interface
- **FR-10.1** MUST use Claude Sonnet 4 with streaming responses
- **FR-10.2** MUST have all MCP tools available (ClickHouse, Cube/Seleric, Pipeboard, Shopify)
- **FR-10.3** MUST inject current business context at session start: P&L summary, top 3 active signals, active campaigns
- **FR-10.4** MUST display tool call traces inline when Claude queries any data source
- **FR-10.5** MUST support slash commands: `/pnl`, `/campaigns`, `/signals`, `/explain [signal_id]`
- **FR-10.6** MUST NOT persist chat history between sessions (session-scoped only)

### FR-11: Control Panel
- **FR-11.1** MUST show pending approval queue sorted by: expiry (soonest first), then risk level (high first)
- **FR-11.2** MUST show auto-execute history with before/after state for each execution
- **FR-11.3** MUST include a YAML rule editor with live validation preview
- **FR-11.4** MUST show per-agent accuracy metrics (proposal approval rate, outcome score avg)
- **FR-11.5** MUST include agent enable/disable toggles (disable specific agents without code changes)

---

## Non-Functional Requirements

### NFR-01: Performance
- **NFR-01.1** Signal-to-insight latency: p95 < 45 seconds (from signal receipt to InsightCard stored)
- **NFR-01.2** Signal-to-approval-notification: p95 < 90 seconds
- **NFR-01.3** P&L dashboard initial load: < 2 seconds (server-side rendered)
- **NFR-01.4** Cube metric queries (via Seleric): < 800ms with cache hit, < 3s cache miss
- **NFR-01.5** Chat first token: < 2 seconds

### NFR-02: Reliability
- **NFR-02.1** The signal processing pipeline MUST NOT lose signals — use at-least-once delivery via BullMQ with persistence
- **NFR-02.2** The orchestrator MUST handle Anthropic API rate limits gracefully (retry with backoff, not fail)
- **NFR-02.3** Individual agent failures MUST NOT prevent other agents from completing — fail individually, not the whole run
- **NFR-02.4** The approval queue MUST survive orchestrator restarts — Postgres-backed, not in-memory
- **NFR-02.5** Auto-execute failures MUST NOT silently fail — alert via Slack and log to audit table

### NFR-03: Security
- **NFR-03.1** All API endpoints MUST require authentication (Clerk JWT or API key for internal services)
- **NFR-03.2** ClickHouse queries MUST go through the query guard layer (no raw SQL injection possible)
- **NFR-03.3** Approval signed URLs MUST use HMAC-SHA256 with a server-side secret and 48h expiry
- **NFR-03.4** Write MCP tools (Pipeboard write, Shopify write) MUST require `WRITE_ENABLED=true`
- **NFR-03.5** `ANTHROPIC_API_KEY`, `DATABASE_URL`, `CLICKHOUSE_PASSWORD` MUST never be exposed to browser
- **NFR-03.6** All service-to-service communication MUST use API keys or shared secrets (not open)

### NFR-04: Observability
- **NFR-04.1** Every signal MUST have a `trace_id` propagated through all downstream operations
- **NFR-04.2** Every tool call made by an agent MUST be logged to the `tool_calls_log` on AgentResult
- **NFR-04.3** Every Guardrail classification MUST be logged with the rule that triggered it
- **NFR-04.4** Sentry MUST capture all unhandled exceptions across all services
- **NFR-04.5** Structured logs MUST include: `service`, `trace_id`, `signal_id`, `entity_id`, `duration_ms`

### NFR-05: Scalability
- **NFR-05.1** The system MUST handle up to 1,000 signals per day without performance degradation
- **NFR-05.2** The worker service MUST support horizontal scaling (stateless job processors)
- **NFR-05.3** pgvector MUST support up to 1,000,000 insight embeddings before migration is required

### NFR-06: Maintainability
- **NFR-06.1** Adding a new agent type MUST require changes to ≤ 3 files (agent module, orchestrator signal map, frontend display)
- **NFR-06.2** Adding a new signal type MUST require changes to ≤ 2 files (rules.yaml, signal map)
- **NFR-06.3** Adding a new Guardrail rule MUST require changes to `config/rules.yaml` only — no code changes
- **NFR-06.4** All services MUST expose a `/health` endpoint returning `{ status: "ok", version, uptime_s }`

---

## Phase Gate Criteria

### Phase 1 Complete when:
- [ ] Orchestrator processes a test signal end-to-end and stores an InsightCard in Postgres
- [ ] Redis session read/write works for an entity
- [ ] Cube metrics fetch via Seleric MCP returns correct ROAS + spend data
- [ ] pgvector similarity search returns relevant results for a test insight
- [ ] ClickHouse query tool passes guard validation and returns data

### Phase 2 Complete when:
- [ ] Insight Agent produces an InsightCard with evidence for a real ROAS drop signal
- [ ] Meta Agent produces an ActionProposal for a real campaign with quantified expected outcome
- [ ] Shopify Agent returns product velocity analysis for real product data
- [ ] Guardrail correctly classifies: 1 AUTO, 1 QUEUE, 1 BLOCK for test proposals

### Phase 3 Complete when:
- [ ] AUTO action executes a real campaign pause via Pipeboard (with WRITE_ENABLED=true in staging)
- [ ] QUEUE action triggers Slack notification and founder can approve via link
- [ ] Outcome store records metric deltas at T+24h for an executed action
- [ ] Approval queue expires correctly at 48h

### Phase 4 Complete when:
- [ ] P&L dashboard loads in < 2s and shows real ClickHouse data via Seleric
- [ ] Insights dashboard shows live InsightCards via WebSocket
- [ ] Chat interface can answer "why did ROAS drop yesterday?" with cited data
- [ ] Control panel shows pending approvals and founder can approve/reject
