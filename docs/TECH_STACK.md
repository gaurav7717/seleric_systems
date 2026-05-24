# Tech Stack

## Core AI

| Component | Technology | Version | Rationale |
|---|---|---|---|
| LLM client | LiteLLM | ≥1.40 | Provider-agnostic wrapper — swap between Anthropic, OpenAI, Google, Azure, Ollama via `LLM_MODEL` env var |
| Default LLM | Claude Sonnet 4 (`claude-sonnet-4-20250514`) | Latest | Best tool-use + JSON output fidelity; used when `LLM_MODEL` is unset |
| Agent framework | LangGraph (Python) | ≥0.2 | Mature state machine for multi-agent LLM workflows; handles cycles, retries, parallel branches |
| Tool format | OpenAI function-calling | — | Standard tool definition format; LiteLLM translates to each provider's native format |
| Embeddings | `text-embedding-3-small` (OpenAI) or `voyage-3-lite` | Latest | For insight vector store; configurable via `EMBEDDING_MODEL` |

## Backend Services

### Orchestrator (Python)
| Layer | Technology | Version | Notes |
|---|---|---|---|
| API framework | FastAPI | ≥0.111 | Async, automatic OpenAPI docs, Pydantic v2 native |
| Agent state machine | LangGraph | ≥0.2 | Nodes + edges + conditional routing |
| HTTP client | httpx | ≥0.27 | Async, used for ClickHouse + Pipeboard calls |
| Data validation | Pydantic v2 | ≥2.7 | Schema validation for all agent I/O |
| Structured logging | structlog | ≥24.1 | JSON logs in prod, colored in dev |
| Config | python-dotenv + pydantic-settings | latest | Type-safe env var loading |
| Templating | Jinja2 | ≥3.1 | Prompt templates |
| Testing | pytest + pytest-asyncio | latest | Async test support |

### Worker (Node.js)
| Layer | Technology | Version | Notes |
|---|---|---|---|
| Job queue | BullMQ | ≥5 | Redis-backed; better than Celery for Node monorepo |
| Runtime | Node.js | ≥20 LTS | |
| TypeScript | ts-node / tsx | latest | Dev runtime |
| HTTP client | node-fetch / undici | latest | For MCP tool calls |
| Testing | Vitest | ≥1 | Fast, ESM-native |

### Shopify MCP Server (Node.js)
| Layer | Technology | Version | Notes |
|---|---|---|---|
| MCP SDK | `@modelcontextprotocol/sdk` | ≥1.0 | Official Anthropic MCP SDK |
| Shopify client | `@shopify/shopify-api` | ≥9 | Official Shopify Admin REST + GraphQL |
| Transport | SSE (Server-Sent Events) | — | Allows remote MCP server deployment |

## Data Layer

| Database | Technology | Version | Purpose |
|---|---|---|---|
| Analytics warehouse | ClickHouse (existing) | — | ad_spend, orders, sessions, GMV — read-only from agents |
| Operational DB | Postgres 16 | — | Approval queue, outcomes, audit log, insight vectors |
| Vector extension | pgvector | ≥0.7 | Cosine similarity search on InsightCard embeddings |
| Cache + session | Redis 7 | — | Entity sessions, metric cache, BullMQ broker |
| ORM | Prisma | ≥5.14 | TypeScript ORM for Postgres (used by frontend + worker) |
| Python DB access | asyncpg | ≥0.29 | Direct async Postgres for Python services (pgvector queries) |

## Frontend

| Layer | Technology | Version | Notes |
|---|---|---|---|
| Framework | Next.js 14 | App Router | Server Components, Server Actions, Route Handlers |
| Language | TypeScript | ≥5.4 | Strict mode |
| Styling | Tailwind CSS | ≥3.4 | Utility-first; no CSS-in-JS |
| Charts | Recharts | ≥2.12 | Consistent charting; lighter than ECharts |
| Data fetching | SWR | ≥2.2 | Client-side revalidation with optimistic updates |
| Streaming AI | Vercel AI SDK (`ai`) | ≥3.1 | Streaming Claude responses in chat interface |
| Auth | Clerk | ≥5 | Founder auth — passwordless, Google SSO; or NextAuth if self-hosted |
| Validation | Zod | ≥3.23 | Schema validation for API inputs |
| Forms | React Hook Form | ≥7 | For rule editor + approval forms |
| Component variants | cva (class-variance-authority) | ≥0.7 | Multi-variant UI components |

## Infrastructure

| Component | Technology | Notes |
|---|---|---|
| Monorepo | Turborepo | Shared build cache, parallel task runner |
| Package manager | pnpm | Workspace support, fast installs |
| Containerisation | Docker + Docker Compose | Local dev; production via Railway/Render |
| Reverse proxy | Nginx | Routes traffic between services in production |
| Python packaging | `uv` (Astral) | Faster than pip; lockfile support |
| Deployment | Railway | Simple multi-service deployment with managed Postgres + Redis |
| Secrets | Railway env vars (prod) / `.env.local` (dev) | Never in code |
| Monitoring | Sentry (errors) + Axiom or Logtail (logs) | Structured log aggregation |

## Already Connected (don't rebuild)
| Service | Status | Use |
|---|---|---|
| Pipeboard MCP | ✅ Connected | Meta + Google Ads read/write via MCP |
| Seleric MCP | ✅ Connected | Cube semantic layer — structured metrics from ClickHouse |
| ClickHouse | ✅ Existing | Analytics warehouse — ad_spend, orders, sessions |
| Ad APIs | ✅ via Pipeboard | Meta + Google campaign management |
| Shopify | ✅ Data source | Need to add Admin API + webhook ingestion |

## Development Environment Requirements
- Node.js ≥ 20 LTS
- Python ≥ 3.12
- Docker Desktop (for local ClickHouse, Postgres, Redis)
- pnpm ≥ 9
- uv (Python package manager): `curl -LsSf https://astral.sh/uv/install.sh | sh`

## Environment Variables Reference

```bash
# ── LLM Provider ────────────────────────────────────
# LiteLLM model string — set to any supported provider/model
LLM_MODEL=claude-sonnet-4-20250514   # default (Anthropic)
# LLM_MODEL=gpt-4o                  # OpenAI
# LLM_MODEL=gemini/gemini-1.5-pro   # Google
# LLM_MODEL=azure/gpt-4o            # Azure OpenAI

ANTHROPIC_API_KEY=sk-ant-...         # if using Anthropic
# OPENAI_API_KEY=sk-...             # if using OpenAI
# GOOGLE_API_KEY=...                # if using Gemini

# ── MCP Connectors ──────────────────────────────────
PIPEBOARD_TOKEN=...            # Pipeboard MCP auth
SELERIC_MCP_URL=https://mcp.seleric.com/sse
SELERIC_API_KEY=...

# ── Data Sources ────────────────────────────────────
CLICKHOUSE_URL=https://...
CLICKHOUSE_USER=default
CLICKHOUSE_PASSWORD=...
CLICKHOUSE_DATABASE=analytics

SHOPIFY_STORE_DOMAIN=yourstore.myshopify.com
SHOPIFY_ADMIN_ACCESS_TOKEN=shpat_...
SHOPIFY_WEBHOOK_SECRET=...

# ── Infrastructure ───────────────────────────────────
DATABASE_URL=postgresql://...
REDIS_URL=redis://...

# ── Application ─────────────────────────────────────
ORCHESTRATOR_API_URL=http://orchestrator:8000
MCP_SHOPIFY_URL=http://mcp-shopify:3100
WRITE_ENABLED=false            # Set true in prod ONLY after Phase 3 testing

# ── Notifications ────────────────────────────────────
SLACK_WEBHOOK_URL=https://hooks.slack.com/services/...
RESEND_API_KEY=re_...          # or SES credentials

# ── Auth (frontend) ─────────────────────────────────
CLERK_SECRET_KEY=sk_...
NEXT_PUBLIC_CLERK_PUBLISHABLE_KEY=pk_...

# ── Monitoring ───────────────────────────────────────
SENTRY_DSN=...
AXIOM_DATASET=...
AXIOM_API_TOKEN=...
```
