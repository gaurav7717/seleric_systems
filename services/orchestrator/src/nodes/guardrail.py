"""guardrail node — classify proposals via guardrail agent."""

import structlog

from src.schemas.agent import AgentContext
from src.state import OrchestratorState

logger = structlog.get_logger()


async def node_guardrail(state: OrchestratorState) -> dict:
    proposals = state.get("action_proposals") or []
    trace_id = state["trace_id"]

    if not proposals:
        return {"auto_actions": [], "queued_actions": [], "blocked_actions": []}

    try:
        from agents.guardrail.src.agent import run

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
        results = await run(context, proposals)

        auto_actions = [r for r in results if r.get("classification") == "AUTO"]
        queued_actions = [r for r in results if r.get("classification") == "QUEUE"]
        blocked_actions = [r for r in results if r.get("classification") == "BLOCK"]

        logger.info(
            "guardrail_completed",
            trace_id=trace_id,
            auto=len(auto_actions),
            queue=len(queued_actions),
            block=len(blocked_actions),
        )

        return {
            "auto_actions": auto_actions,
            "queued_actions": queued_actions,
            "blocked_actions": blocked_actions,
        }
    except Exception as e:
        logger.error("guardrail_failed", trace_id=trace_id, error=str(e))
        errors = list(state.get("errors") or [])
        errors.append(f"guardrail: {e}")
        return {"errors": errors}
