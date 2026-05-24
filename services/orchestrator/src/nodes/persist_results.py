"""persist_results node — save InsightCard to Postgres + update Redis session."""

import structlog

from src.db.client import get_pool
from src.db.insight_store import save_insight
from src.memory.redis_client import merge_session
from src.state import OrchestratorState

logger = structlog.get_logger()


async def node_persist_results(state: OrchestratorState) -> dict:
    insight_card = state.get("insight_card")
    trace_id = state["trace_id"]
    errors = list(state.get("errors") or [])

    if not insight_card:
        logger.debug("no_insight_card_to_persist", trace_id=trace_id)
        return {}

    # ── Save InsightCard to Postgres ─────────────────────────────────────────
    try:
        pool = await get_pool()
        await save_insight(pool, insight_card, state["signal_id"])
        logger.info("insight_persisted", insight_id=insight_card["id"], trace_id=trace_id)
    except Exception as exc:
        logger.error("insight_persist_failed", trace_id=trace_id, error=str(exc))
        errors.append(f"persist_insight: {exc}")

    # ── Update Redis session with latest insight summary ──────────────────────
    try:
        await merge_session(
            state["entity_type"],
            state["entity_id"],
            {
                "last_signal_type": state["signal_type"],
                "last_insight_id": insight_card["id"],
                "last_insight_title": insight_card.get("title", ""),
                "last_insight_severity": insight_card.get("severity", "info"),
            },
        )
    except Exception as exc:
        # Session update failure is non-critical — log and continue
        logger.warning("session_update_failed", trace_id=trace_id, error=str(exc))

    if errors:
        return {"errors": errors}
    return {}
