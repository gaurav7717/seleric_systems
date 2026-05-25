# Folder Structure

```
multiagent-system/
│
├── .cursor/
│   └── rules/
│       ├── 00-general.mdc          # Project-wide conventions, naming, security
│       ├── 01-orchestrator.mdc     # LangGraph patterns, context assembly, node rules
│       ├── 02-agents.mdc           # Agent interface, tool use loop, output schemas
│       ├── 03-frontend.mdc         # Next.js 14 patterns, component rules, chat
│       ├── 04-mcp-tools.mdc        # MCP server patterns, tool definitions, Pipeboard
│       └── 05-database.mdc         # Prisma, Redis key schema, ClickHouse patterns
│
├── docs/
│   ├── ARCHITECTURE.md             # System diagram, service map, external connections
│   ├── DATA_FLOW.md                # End-to-end flows for signal → insight → action
│   ├── CHAT.md                     # Chat architecture, tools, streaming, visual output
│   ├── TECH_STACK.md               # Technology choices with rationale
│   ├── REQUIREMENTS.md             # Functional + non-functional requirements, phase gates
│   └── FOLDER_STRUCTURE.md         # This file
│
├── services/
│   │
│   ├── orchestrator/               # Python · FastAPI + LangGraph · Port 8000
│   │   ├── src/
│   │   │   ├── main.py             # FastAPI app entry point
│   │   │   ├── graph.py            # LangGraph StateGraph definition
│   │   │   ├── state.py            # OrchestratorState TypedDict
│   │   │   ├── api/
│   │   │   │   ├── __init__.py
│   │   │   │   ├── routes.py       # /signal, /health, /status/{trace_id}
│   │   │   │   └── schemas.py      # Pydantic request/response models
│   │   │   ├── nodes/
│   │   │   │   ├── __init__.py
│   │   │   │   ├── validate_signal.py
│   │   │   │   ├── assemble_context.py
│   │   │   │   ├── route_agents.py
│   │   │   │   ├── run_agents.py   # Parallel agent dispatch
│   │   │   │   ├── guardrail.py
│   │   │   │   └── dispatch_actions.py
│   │   │   ├── prompts/
│   │   │   │   ├── insight.j2      # Jinja2 prompt for Insight Agent
│   │   │   │   ├── meta.j2         # Jinja2 prompt for Meta Agent
│   │   │   │   ├── shopify.j2      # Jinja2 prompt for Shopify Agent
│   │   │   │   └── guardrail.j2    # Jinja2 prompt for Guardrail Agent
│   │   │   ├── memory/
│   │   │   │   ├── __init__.py
│   │   │   │   ├── redis_client.py # Session read/write/cache
│   │   │   │   ├── vector_client.py# pgvector search + insert
│   │   │   │   └── cube_client.py  # Seleric MCP / Cube REST calls
│   │   │   ├── tools/
│   │   │   │   ├── __init__.py
│   │   │   │   ├── clickhouse.py   # Query tool definition + executor
│   │   │   │   ├── query_guard.py  # SQL validation layer
│   │   │   │   └── pipeboard.py    # Pipeboard MCP HTTP client
│   │   │   ├── schemas/
│   │   │   │   ├── __init__.py
│   │   │   │   ├── signal.py       # SignalSchema
│   │   │   │   ├── insight.py      # InsightCard
│   │   │   │   ├── action.py       # ActionProposal, GuardrailResult
│   │   │   │   └── agent.py        # AgentContext, AgentResult
│   │   │   └── exceptions.py       # Custom exception classes
│   │   ├── tests/
│   │   │   ├── conftest.py
│   │   │   ├── test_graph.py
│   │   │   ├── test_context_assembly.py
│   │   │   └── test_guardrail.py
│   │   ├── pyproject.toml
│   │   ├── requirements.txt
│   │   └── Dockerfile
│   │
│   ├── agents/                     # Python packages · imported by orchestrator
│   │   ├── insight/
│   │   │   ├── src/
│   │   │   │   ├── __init__.py
│   │   │   │   ├── agent.py        # run(context) -> AgentResult
│   │   │   │   ├── tools.py        # get_tool_definitions() + execute_tool()
│   │   │   │   └── parser.py       # parse_response() → InsightCard
│   │   │   └── tests/
│   │   │       └── test_insight_agent.py
│   │   ├── meta/
│   │   │   ├── src/
│   │   │   │   ├── __init__.py
│   │   │   │   ├── agent.py
│   │   │   │   ├── tools.py        # Pipeboard tool definitions + caller
│   │   │   │   └── parser.py       # parse → list[ActionProposal]
│   │   │   └── tests/
│   │   │       └── test_meta_agent.py
│   │   ├── shopify/
│   │   │   ├── src/
│   │   │   │   ├── __init__.py
│   │   │   │   ├── agent.py
│   │   │   │   ├── tools.py        # Shopify MCP tool definitions + caller
│   │   │   │   └── parser.py
│   │   │   └── tests/
│   │   │       └── test_shopify_agent.py
│   │   └── guardrail/
│   │       ├── src/
│   │       │   ├── __init__.py
│   │       │   ├── agent.py        # run(proposals) -> list[GuardrailResult]
│   │       │   ├── rules_loader.py # Load + validate config/rules.yaml
│   │       │   └── classifier.py   # Rule evaluation logic
│   │       └── tests/
│   │           └── test_guardrail_agent.py
│   │
│   ├── worker/                     # Node.js · BullMQ · Background jobs
│   │   ├── src/
│   │   │   ├── index.ts            # Worker entry point, queue registrations
│   │   │   ├── queues.ts           # Queue name constants + BullMQ instances
│   │   │   ├── jobs/
│   │   │   │   ├── execute-action.ts    # Calls Pipeboard/Shopify MCP
│   │   │   │   ├── send-notification.ts # Slack + email via Resend
│   │   │   │   ├── record-outcome.ts    # Polls ClickHouse post-execution
│   │   │   │   └── embed-insight.ts     # Generates + stores embedding
│   │   │   ├── processors/
│   │   │   │   ├── pipeboard.ts    # Pipeboard MCP write operations
│   │   │   │   ├── shopify.ts      # Shopify Admin API write operations
│   │   │   │   └── notifications.ts
│   │   │   └── lib/
│   │   │       ├── db.ts           # Prisma client
│   │   │       ├── redis.ts        # Redis client (ioredis)
│   │   │       └── anthropic.ts    # Embedding API calls
│   │   ├── tests/
│   │   ├── package.json
│   │   ├── tsconfig.json
│   │   └── Dockerfile
│   │
│   └── mcp-shopify/                # Node.js · MCP SDK · SSE · Port 3100
│       ├── src/
│       │   ├── server.ts           # MCP server entry point
│       │   ├── tools/
│       │   │   ├── index.ts        # Tool registry (LIST_TOOLS_RESULT)
│       │   │   ├── get-products.ts
│       │   │   ├── get-orders.ts
│       │   │   ├── get-inventory.ts
│       │   │   ├── get-analytics.ts
│       │   │   ├── update-product.ts    # WRITE — checks WRITE_ENABLED
│       │   │   └── create-discount.ts  # WRITE — checks WRITE_ENABLED
│       │   ├── handlers/
│       │   │   └── shopify-client.ts   # Shopify Admin API wrapper
│       │   └── lib/
│       │       └── write-guard.ts  # Checks WRITE_ENABLED env var
│       ├── tests/
│       ├── package.json
│       ├── tsconfig.json
│       └── Dockerfile
│
├── apps/
│   └── web/                        # Next.js 14 · App Router · Port 3000
│       ├── src/
│       │   ├── app/
│       │   │   ├── layout.tsx      # Root layout (Clerk auth, global nav)
│       │   │   ├── page.tsx        # Root redirect → /dashboard
│       │   │   ├── (auth)/
│       │   │   │   ├── sign-in/page.tsx
│       │   │   │   └── sign-up/page.tsx
│       │   │   ├── dashboard/
│       │   │   │   ├── page.tsx        # P&L overview (Server Component)
│       │   │   │   └── loading.tsx
│       │   │   ├── insights/
│       │   │   │   ├── page.tsx        # Insight feed (hybrid)
│       │   │   │   └── [id]/page.tsx   # Insight detail
│       │   │   ├── ads/
│       │   │   │   ├── page.tsx        # Ads intelligence
│       │   │   │   ├── [campaignId]/page.tsx
│       │   │   │   └── loading.tsx
│       │   │   ├── shopify/
│       │   │   │   ├── page.tsx        # Shopify intelligence
│       │   │   │   └── products/page.tsx
│       │   │   ├── chat/
│       │   │   │   └── page.tsx        # Claude Code-style chat
│       │   │   ├── control/
│       │   │   │   ├── page.tsx        # Control panel root
│       │   │   │   ├── approvals/page.tsx
│       │   │   │   ├── history/page.tsx
│       │   │   │   └── rules/page.tsx  # YAML rule editor
│       │   │   └── api/
│       │   │       ├── metrics/
│       │   │       │   └── route.ts    # Cube metric proxy
│       │   │       ├── campaigns/
│       │   │       │   └── route.ts    # Pipeboard campaigns proxy
│       │   │       ├── insights/
│       │   │       │   ├── route.ts    # GET insights list
│       │   │       │   └── stream/route.ts  # SSE/WebSocket push
│       │   │       ├── approvals/
│       │   │       │   ├── route.ts         # GET pending actions
│       │   │       │   └── [id]/route.ts    # POST approve/reject
│       │   │       ├── chat/
│       │   │       │   └── route.ts    # Streaming Claude chat endpoint
│       │   │       ├── webhooks/
│       │   │       │   └── shopify/route.ts # Shopify webhook receiver
│       │   │       └── health/route.ts
│       │   ├── components/
│       │   │   ├── ui/             # Primitive components
│       │   │   │   ├── button.tsx
│       │   │   │   ├── badge.tsx
│       │   │   │   ├── card.tsx
│       │   │   │   ├── skeleton.tsx
│       │   │   │   ├── dialog.tsx
│       │   │   │   └── toast.tsx
│       │   │   ├── charts/
│       │   │   │   ├── MetricCard.tsx      # KPI card with delta
│       │   │   │   ├── SpendRevenueChart.tsx
│       │   │   │   ├── RoasChart.tsx
│       │   │   │   ├── ChannelBreakdown.tsx
│       │   │   │   └── ProductVelocity.tsx
│       │   │   ├── insights/
│       │   │   │   ├── InsightCard.tsx     # Single insight card
│       │   │   │   ├── InsightFeed.tsx     # Live feed with WebSocket
│       │   │   │   └── InsightDetail.tsx
│       │   │   ├── actions/
│       │   │   │   ├── ActionCard.tsx      # Pending action card
│       │   │   │   ├── ApprovalDialog.tsx  # Approve/reject modal
│       │   │   │   └── ExecutionLog.tsx    # Auto-execute history
│       │   │   ├── chat/
│       │   │   │   ├── ChatWindow.tsx
│       │   │   │   ├── ToolCallTrace.tsx   # Shows tool call inline
│       │   │   │   └── CommandInput.tsx    # Handles slash commands
│       │   │   └── layout/
│       │   │       ├── Shell.tsx
│       │   │       ├── Sidebar.tsx
│       │   │       └── Header.tsx
│       │   ├── lib/
│       │   │   ├── cube.ts         # Cube/Seleric API client
│       │   │   ├── anthropic.ts    # Claude streaming client
│       │   │   ├── db.ts           # Prisma client singleton
│       │   │   ├── redis.ts        # Server-side Redis
│       │   │   └── utils.ts
│       │   ├── hooks/
│       │   │   ├── use-insight-stream.ts
│       │   │   ├── use-approval-queue.ts
│       │   │   └── use-chat.ts
│       │   └── types/
│       │       └── index.ts        # Re-exports from packages/shared-types
│       ├── public/
│       ├── next.config.ts
│       ├── tailwind.config.ts
│       ├── tsconfig.json
│       └── package.json
│
├── packages/
│   ├── db/                         # Shared Prisma schema
│   │   ├── prisma/
│   │   │   ├── schema.prisma       # All models
│   │   │   └── migrations/
│   │   ├── src/
│   │   │   └── client.ts           # Prisma client singleton
│   │   ├── package.json
│   │   └── tsconfig.json
│   ├── shared-types/               # Shared TypeScript types
│   │   ├── src/
│   │   │   ├── signal.ts
│   │   │   ├── insight.ts
│   │   │   ├── action.ts
│   │   │   └── index.ts
│   │   ├── package.json
│   │   └── tsconfig.json
│   └── config/                     # Shared config loaders
│       ├── src/
│       │   └── env.ts              # Zod env schema validation
│       ├── package.json
│       └── tsconfig.json
│
├── config/
│   └── rules.yaml                  # Guardrail rules — editable without code changes
│
├── infra/
│   ├── docker/
│   │   ├── postgres/init.sql       # pgvector extension + indexes
│   │   └── clickhouse/schema.sql   # ClickHouse table definitions
│   ├── nginx/
│   │   └── nginx.conf              # Production reverse proxy config
│   └── scripts/
│       ├── setup-dev.sh            # One-command dev environment setup
│       ├── seed-test-data.sh       # Seed ClickHouse + Postgres with test data
│       └── check-connections.sh    # Validate all external service connections
│
├── docker-compose.yml              # Local dev: Postgres, Redis, all services
├── docker-compose.prod.yml         # Production overrides
├── .env.example                    # All env vars with descriptions
├── .gitignore
├── turbo.json                      # Turborepo pipeline config
├── package.json                    # Root (pnpm workspace)
├── pnpm-workspace.yaml
└── README.md
```

## Key File Responsibilities (quick reference)

| File | Responsibility |
|---|---|
| `services/orchestrator/src/graph.py` | LangGraph StateGraph — the only place edges and nodes are wired together |
| `services/orchestrator/src/nodes/assemble_context.py` | Redis + pgvector + Cube context fetch — single source of truth for context |
| `services/agents/guardrail/src/classifier.py` | Guardrail rule evaluation — all classification logic here |
| `config/rules.yaml` | Guardrail thresholds and rules — edit this to change behaviour without code |
| `apps/web/src/app/api/chat/route.ts` | Chat endpoint — injects business context, streams Claude response |
| `apps/web/src/app/api/approvals/[id]/route.ts` | Approval endpoint — validates token, updates status, enqueues execution |
| `services/worker/src/jobs/execute-action.ts` | Actual MCP write call — only place production writes happen |
| `services/worker/src/jobs/record-outcome.ts` | Outcome measurement — feeds back to signal calibration |
| `packages/db/prisma/schema.prisma` | Single source of truth for all database models |
