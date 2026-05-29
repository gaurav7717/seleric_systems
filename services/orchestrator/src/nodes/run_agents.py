"""run_agents node — parallel specialist agent dispatch."""

import asyncio
import time

import structlog

from src.schemas.agent import AgentContext, AgentResult
from src.state import OrchestratorState

logger = structlog.get_logger()

AGENT_MODULES = {
    "insight_agent": "insight",
    "meta_agent": "meta",
    "shopify_agent": "shopify",
}


async def _run_single_agent(agent_name: str, context: AgentContext) -> AgentResult:
    module_name = AGENT_MODULES.get(agent_name)
    if not module_name:
        raise ValueError(f"Unknown agent: {agent_name}")

    if module_name == "insight":
        from agents.insight.src.agent import run
    elif module_name == "meta":
        from agents.meta.src.agent import run
    elif module_name == "shopify":
        from agents.shopify.src.agent import run
    else:
        raise ValueError(f"No import path for agent: {agent_name}")

    return await run(context)


async def node_run_agents(state: OrchestratorState) -> dict:
    errors = list(state.get("errors") or [])
    agents = list(state.get("agents_to_run") or [])
    trace_id = state["trace_id"]

    context = AgentContext(
        signal_id=state["signal_id"],
        entity_type=state["entity_type"],
        entity_id=state["entity_id"],
        signal_type=state["signal_type"],
        assembled_prompt=state.get("assembled_prompt") or "",
        context_snapshot=state.get("context_snapshot") or {},
        current_metrics=state.get("current_metrics") or {},
        session_memory=state.get("session_memory"),
        similar_insights=state.get("similar_insights"),
        available_tools=[],
    )

    start = time.monotonic()
    results: list[AgentResult] = []

    try:
        tasks = [_run_single_agent(name, context) for name in agents]
        if tasks:
            results = await asyncio.gather(*tasks, return_exceptions=False)
    except Exception as e:
        logger.error("agent_execution_failed", trace_id=trace_id, error=str(e))
        errors.append(f"agent_execution: {e}")
        return {"errors": errors}

    insight_card = None
    action_proposals: list[dict] = []

    for result in results:
        if result.insight:
            insight_card = result.insight
        action_proposals.extend(result.action_proposals)

    logger.info(
        "agents_completed",
        trace_id=trace_id,
        agents=agents,
        latency_ms=int((time.monotonic() - start) * 1000),
        proposal_count=len(action_proposals),
    )

    return {
        "insight_card": insight_card,
        "action_proposals": action_proposals,
        "agent_results": [r.model_dump() for r in results],
    }
