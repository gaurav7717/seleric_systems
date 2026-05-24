"""
OrchestratorState — the single TypedDict passed through every LangGraph node.
Every node receives this state and returns a dict with ONLY the keys it modifies.
LangGraph merges the returned dict into the state automatically.
"""

from typing import Literal, Optional, TypedDict


class OrchestratorState(TypedDict):
    # ── Input (set once at entry, never modified) ──────────────────────────
    signal_id: str
    entity_type: Literal["campaign", "adset", "product", "store"]
    entity_id: str
    signal_type: str
    context_snapshot: dict
    trace_id: str

    # ── Assembled context (set by assemble_context node) ───────────────────
    session_memory: Optional[dict]       # From Redis
    similar_insights: Optional[list]     # From pgvector — list[InsightCard]
    current_metrics: Optional[dict]      # From Cube / Seleric MCP
    assembled_prompt: Optional[str]      # Final Jinja2-rendered prompt

    # ── Routing (set by route_agents node) ────────────────────────────────
    agents_to_run: Optional[list[str]]   # e.g. ["insight_agent", "meta_agent"]

    # ── Agent outputs (set by run_agents node) ─────────────────────────────
    insight_card: Optional[dict]         # InsightCard from insight_agent
    action_proposals: Optional[list]     # list[ActionProposal] from all agents
    agent_results: Optional[list]        # Full AgentResult objects for audit log

    # ── Guardrail outputs (set by guardrail node) ──────────────────────────
    auto_actions: Optional[list]         # Proposals classified AUTO
    queued_actions: Optional[list]       # Proposals classified QUEUE
    blocked_actions: Optional[list]      # Proposals classified BLOCK

    # ── Execution outputs (set by dispatch_actions node) ───────────────────
    execution_results: Optional[list]    # Results from auto-executed actions

    # ── Error tracking (appended by any node that encounters an error) ─────
    errors: list[str]
