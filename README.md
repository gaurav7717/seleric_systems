# Multi-Agent Business Intelligence System

A multi-agent AI system that monitors your business (Shopify + Meta/Google Ads + ClickHouse) and generates actionable insights with automated or founder-approved execution.

## Architecture

```
Signal fired (every 15 min)
    → Orchestrator (LangGraph)
        → Insight Agent + Specialist Agent(s)
            → Guardrail Agent
                → AUTO execute OR Approval queue
                    → Outcome store → signal calibration
```

**Services:**
| Service | Stack | Port |
|---|---|---|
| Orchestrator | Python, FastAPI, LangGraph | 8000 |
| Worker | Node.js, BullMQ | — |
| MCP Shopify | Node.js, MCP SDK | 3100 |
| Web | Next.js 14 App Router | 3000 |

**Already connected:** Pipeboard MCP (Meta + Google Ads), Seleric MCP (Cube metrics), ClickHouse

---

## Quick Start

### Prerequisites
- Node.js ≥ 20, pnpm ≥ 9
- Python ≥ 3.12, [uv](https://docs.astral.sh/uv/)
- Docker Desktop

### 1. Setup

```bash
git clone <repo> multiagent-system
cd multiagent-system
bash infra/scripts/setup-dev.sh
```

### 2. Configure

Fill in `.env.local` (created by setup script):

```bash
# LLM provider — pick one and set the matching API key
LLM_MODEL=claude-sonnet-4-20250514   # Anthropic (default)
# LLM_MODEL=gpt-4o                  # OpenAI
# LLM_MODEL=gemini/gemini-1.5-pro   # Google
ANTHROPIC_API_KEY=sk-ant-...         # replace with OPENAI_API_KEY / GOOGLE_API_KEY as needed

# Data sources
CLICKHOUSE_URL=...
SHOPIFY_STORE_DOMAIN=yourstore.myshopify.com
SHOPIFY_ADMIN_ACCESS_TOKEN=shpat_...
PIPEBOARD_TOKEN=...
SELERIC_API_KEY=...
```

### 3. Check connections

```bash
bash infra/scripts/check-connections.sh
```

### 4. Start development

```bash
pnpm dev
```

Opens:
- **Frontend:** http://localhost:3000
- **Orchestrator API docs:** http://localhost:8000/docs
- **Shopify MCP:** http://localhost:3100

---

## Development Guide

### Adding a new agent

1. Create `services/agents/{name}/src/agent.py` implementing `run(context) -> AgentResult`
2. Add the agent name to `SIGNAL_AGENT_MAP` in `services/orchestrator/src/nodes/route_agents.py`
3. Add display handling in the frontend `InsightCard` or `ActionCard` components
4. Write tests in `services/agents/{name}/tests/`

### Adding a new signal type

1. Add the signal type and its agent list to `SIGNAL_AGENT_MAP` in `route_agents.py`
2. Add YAML rules to `config/rules.yaml` if new Guardrail thresholds are needed
3. Update the rule engine YAML definition in your signal scanner

### Changing Guardrail rules

Edit `config/rules.yaml` — no code changes or redeploys required. Changes take effect on the next signal.

### Enabling write operations (Phase 3)

```bash
# In .env.local or Railway environment variables:
WRITE_ENABLED=true
```

**Only enable after:** the Guardrail agent has been tested with real signals for 2+ weeks.

---

## Project Structure

```
.cursor/rules/       → Cursor AI rules for each service domain
docs/                → Architecture, data flow, tech stack, requirements
services/
  orchestrator/      → Python FastAPI + LangGraph
  agents/            → Insight, Meta, Shopify, Guardrail agent modules
  worker/            → BullMQ async job processor
  mcp-shopify/       → Custom Shopify MCP server
apps/web/            → Next.js 14 frontend
packages/
  db/                → Prisma schema + client
  shared-types/      → TypeScript types across services
config/
  rules.yaml         → Guardrail rules (edit without code changes)
infra/               → Docker, Postgres init, setup scripts
```

Full folder reference: [docs/FOLDER_STRUCTURE.md](docs/FOLDER_STRUCTURE.md)

---

## Documentation

| Document | Contents |
|---|---|
| [docs/ARCHITECTURE.md](docs/ARCHITECTURE.md) | System diagram, service map, external connections |
| [docs/DATA_FLOW.md](docs/DATA_FLOW.md) | End-to-end flows: signal → insight → action → outcome |
| [docs/CHAT.md](docs/CHAT.md) | Chat architecture, tools, streaming behavior, charts, sandbox, debugging |
| [docs/TECH_STACK.md](docs/TECH_STACK.md) | Technology choices with rationale and versions |
| [docs/REQUIREMENTS.md](docs/REQUIREMENTS.md) | Functional + non-functional requirements, phase gates |
| [docs/FOLDER_STRUCTURE.md](docs/FOLDER_STRUCTURE.md) | Full annotated folder tree |

---

## Phase Status

- [ ] **Phase 1** — Intelligence Core (Orchestrator, memory, Cube, MCP tools)
- [ ] **Phase 2** — Agent Layer (Insight, Meta, Shopify, Guardrail)
- [ ] **Phase 3** — Action & Output (Auto-execute, approval queue, outcome store)
- [ ] **Phase 4** — Frontend (P&L, insights, ads, Shopify, chat, control panel)

See phase gate criteria in [docs/REQUIREMENTS.md](docs/REQUIREMENTS.md#phase-gate-criteria).
