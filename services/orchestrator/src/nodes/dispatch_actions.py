"""dispatch_actions node — enqueue AUTO actions, queue QUEUE actions for approval."""

import structlog

from src.state import OrchestratorState

logger = structlog.get_logger()


async def node_dispatch_actions(state: OrchestratorState) -> dict:
    auto_actions = state.get("auto_actions") or []
    queued_actions = state.get("queued_actions") or []
    trace_id = state["trace_id"]

    execution_results: list[dict] = []

    for action in auto_actions:
        logger.info(
            "auto_action_dispatched",
            trace_id=trace_id,
            proposal_id=action.get("proposal_id"),
            action_type=action.get("action_type"),
        )
        execution_results.append({"proposal_id": action.get("proposal_id"), "status": "queued"})

    for action in queued_actions:
        logger.info(
            "action_queued_for_approval",
            trace_id=trace_id,
            proposal_id=action.get("proposal_id"),
        )

    return {"execution_results": execution_results}
