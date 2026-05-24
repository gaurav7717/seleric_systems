# System Architecture

## Overview

This is a multi-agent AI business intelligence system that monitors a founder's business (Shopify + Meta/Google Ads + ClickHouse data warehouse) and autonomously generates insights and executes approved actions.

```
DATA SOURCES          RULE ENGINE              INTELLIGENCE CORE
─────────────         ───────────              ─────────────────
ClickHouse     ──┐
Ad APIs        ──┼──▶  Signal Scanner  ──▶  Signal fired
Shopify        ──┘      (every 15 min)       entity + context snapshot
                        Rule Registry                  │
                        Signals Log                    ▼
                                            ┌──────────────────────┐
                                            │   Orchestrator Agent  │
                        ┌──────────────────▶│  - Context assembly   │◀────────────────┐
                        │                   │  - Agent routing      │                 │
               Short-term mem               │  - Action planning    │     Cube semantic│
               (Redis session) ◀──────────▶│  - Memory lookup      │◀──▶ layer       │
               Vector store                 │  - Prompt construction│     MCP tools   │
               (past insights) ◀──────────▶└──────────────────────┘                 │
                        │                            │                               │
                        └────────────────────────────┘                               │
                                                      │                               │
                    AGENT LAYER                       │                               │
                    ───────────                       ▼                               │
                    ┌──────────┐  ┌──────────┐  ┌──────────┐  ┌──────────┐         │
                    │ Insight  │  │  Meta    │  │ Shopify  │  │Guardrail │         │
                    │  Agent   │  │  Agent   │  │  Agent   │  │  Agent   │         │
                    │diagnose+ │  │ads+      │  │products+ │  │approve+  │         │
                    │narrate   │  │budgets   │  │orders    │  │block     │         │
                    └──────────┘  └──────────┘  └──────────┘  └──────────┘         │
                          │              │             │             │               │
                          └──────────────┴─────────────┴────────────┘               │
                                                      │                               │
                    ACTION & OUTPUT                   ▼                               │
                    ───────────────       ┌──────────────────┐                       │
                                          │  Guardrail Gate   │                       │
                                          │ AUTO │   QUEUE    │                       │
                                          └──────────────────┘                       │
                                               │         │                            │
                                               ▼         ▼                            │
                                        Auto execute  Approval queue                  │
                                        (pause,       (founder reviews)               │
                                        budget ±10%)                                  │
                                               │         │                            │
                                               └────┬────┘                            │
                                                    ▼                                 │
                                            Outcome store ──────────────────────────▶┘
                                            (calibrates future signals)
```

## Service Architecture

### services/orchestrator (Python, FastAPI + LangGraph)
**Port:** 8000  
**Role:** Central brain. Receives signals, assembles context, routes to agents, collects proposals, passes through Guardrail.

Key modules:
- `src/graph.py` — LangGraph state machine definition
- `src/nodes/` — Individual graph nodes (assemble_context, route_agents, collect_proposals, etc.)
- `src/prompts/` — Jinja2 prompt templates per agent type
- `src/memory/` — Redis, pgvector, and Cube client wrappers
- `src/tools/` — ClickHouse query tool definition and executor
- `src/api/` — FastAPI routes (`/signal`, `/health`, `/status/{trace_id}`)

### services/agents (Python packages, imported by orchestrator)
Each agent is a Python package with a single `run(context) -> result` interface.

- `insight/` — Diagnoses anomalies, generates InsightCards
- `meta/` — Analyzes ad performance, proposes budget/bid changes via Pipeboard
- `shopify/` — Analyzes product + order data, proposes merchandising actions
- `guardrail/` — Validates all proposals against YAML rule registry, classifies AUTO/QUEUE/BLOCK

### services/worker (Node.js, BullMQ)
**Port:** N/A (background worker, no HTTP)  
**Role:** Async job processor for: executing approved actions, sending notifications, recording outcomes, embedding insights.

Queues:
- `execute-action` — Calls Pipeboard or Shopify MCP to execute approved actions
- `send-notification` — Slack + email notifications for approval queue items
- `record-outcome` — Polls metrics post-execution to measure outcome
- `embed-insight` — Generates and stores embedding for new InsightCards

### services/mcp-shopify (Node.js, MCP SDK)
**Port:** 3100 (SSE transport)  
**Role:** Custom MCP server exposing Shopify Admin REST API as MCP tools for Claude agents.

### apps/web (Next.js 14, App Router)
**Port:** 3000  
**Role:** Founder-facing product — all dashboards, chat interface, control panel.

Views:
- `/dashboard` — P&L overview (revenue, spend, MER, ROAS, CAC, AOV)
- `/insights` — Live insight feed from signal engine
- `/ads` — Meta + Google campaign intelligence
- `/shopify` — Product + order intelligence
- `/chat` — Claude Code-style chat with full data access
- `/control` — Approval queue + auto-execute history + rule editor

### packages/db (Prisma)
Shared Prisma schema + generated client used by orchestrator (Python via direct SQL) and frontend (TypeScript via Prisma Client).

### packages/shared-types (TypeScript)
Type definitions shared between `apps/web`, `services/worker`, and `services/mcp-shopify`:
- `Signal`, `InsightCard`, `ActionProposal`, `PendingAction`, `OutcomeRecord`

## External Service Connections

| Service | Protocol | Direction | Phase |
|---|---|---|---|
| Anthropic API | HTTPS | Outbound from orchestrator + web | 1 |
| Pipeboard MCP (Meta/Google) | HTTPS MCP | Outbound from orchestrator | 1 |
| Seleric MCP (Cube) | HTTPS MCP | Outbound from orchestrator + web | 1 |
| ClickHouse | HTTP | Outbound from orchestrator | 1 |
| Shopify Admin API | HTTPS | Outbound from mcp-shopify | 1 |
| Shopify Webhooks | HTTPS | Inbound to web `/api/webhooks/shopify` | 1 |
| Slack Webhook | HTTPS | Outbound from worker | 3 |
| Email (Resend/SES) | HTTPS | Outbound from worker | 3 |

## Monorepo Structure
This is a Turborepo monorepo. Services are independent deployable units sharing packages.

```
turborepo
├── apps/web           → Vercel or Railway
├── services/orchestrator → Railway (Python)
├── services/worker    → Railway (Node.js)
├── services/mcp-shopify → Railway (Node.js, SSE)
└── packages/          → Not deployed; build-time only
```
