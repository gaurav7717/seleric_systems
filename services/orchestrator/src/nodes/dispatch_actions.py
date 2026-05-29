"""dispatch_actions node — persist AUTO/QUEUE actions and log dispatch."""

import structlog

from src.db.client import get_pool
from src.db.insight_store import save_pending_action
from src.state import OrchestratorState

logger = structlog.get_logger()


async def node_dispatch_actions(state: OrchestratorState) -> dict:
    auto_actions = state.get("auto_actions") or []
    queued_actions = state.get("queued_actions") or []
    trace_id = state["trace_id"]
    signal_id = state["signal_id"]
    errors = list(state.get("errors") or [])
    execution_results: list[dict] = []

    pool = await get_pool()

    for action in auto_actions:
        try:
            action_id = await save_pending_action(pool, action, signal_id)
            logger.info(
                "auto_action_dispatched",
                trace_id=trace_id,
                action_id=action_id,
                action_type=action.get("action_type"),
            )
            execution_results.append({"action_id": action_id, "status": "queued"})
        except Exception as exc:
            logger.error("auto_action_persist_failed", trace_id=trace_id, error=str(exc))
            errors.append(f"persist_auto_action: {exc}")

    for action in queued_actions:
        try:
            action_id = await save_pending_action(pool, action, signal_id)
            logger.info(
                "action_queued_for_approval",
                trace_id=trace_id,
                action_id=action_id,
                action_type=action.get("action_type"),
            )
        except Exception as exc:
            logger.error("queue_action_persist_failed", trace_id=trace_id, error=str(exc))
            errors.append(f"persist_queue_action: {exc}")

    return {"execution_results": execution_results, "errors": errors}
