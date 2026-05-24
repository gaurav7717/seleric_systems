"""
route_agents.py — Maps signal types to agent lists.
To add a new signal: add a key to SIGNAL_AGENT_MAP.
To add a new agent: add it to the relevant signal lists and implement the agent module.
"""

import structlog

from src.state import OrchestratorState

logger = structlog.get_logger()

# ── Signal → agent routing map ───────────────────────────────────────────────
# Insight agent always runs first (diagnosis before action proposals).
# Guardrail agent is always added last by the run_agents node — do not add here.
SIGNAL_AGENT_MAP: dict[str, list[str]] = {
    "roas_drop":            ["insight_agent", "meta_agent"],
    "spend_spike":          ["insight_agent", "meta_agent"],
    "cpa_spike":            ["insight_agent", "meta_agent"],
    "budget_exhausted":     ["meta_agent"],
    "revenue_drop":         ["insight_agent", "shopify_agent"],
    "conversion_drop":      ["insight_agent", "shopify_agent"],
    "stock_critical":       ["shopify_agent"],
    "ltv_decline":          ["insight_agent", "shopify_agent"],
    "high_return_rate":     ["insight_agent", "shopify_agent"],
    "blended_roas_drop":    ["insight_agent", "meta_agent", "shopify_agent"],
}

# Fallback for unknown signal types — just diagnose, no action
DEFAULT_AGENTS = ["insight_agent"]


async def node_route_agents(state: OrchestratorState) -> dict:
    """Determine which agents to run for this signal type."""
    signal_type = state["signal_type"]
    agents = SIGNAL_AGENT_MAP.get(signal_type, DEFAULT_AGENTS)

    if signal_type not in SIGNAL_AGENT_MAP:
        logger.warning(
            "unknown_signal_type_using_default",
            signal_type=signal_type,
            trace_id=state["trace_id"],
        )

    logger.info(
        "agents_routed",
        signal_type=signal_type,
        agents=agents,
        trace_id=state["trace_id"],
    )

    return {"agents_to_run": agents}
