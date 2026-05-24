"""validate_signal node — dedupe check and payload validation."""

import structlog

from src.schemas.signal import SignalSchema
from src.state import OrchestratorState

logger = structlog.get_logger()


async def node_validate_signal(state: OrchestratorState) -> dict:
    errors = list(state.get("errors") or [])
    try:
        SignalSchema(
            signal_id=state["signal_id"],
            entity_type=state["entity_type"],
            entity_id=state["entity_id"],
            signal_type=state["signal_type"],
            context_snapshot=state["context_snapshot"],
            trace_id=state["trace_id"],
        )
    except Exception as e:
        logger.warning("signal_validation_failed", trace_id=state["trace_id"], error=str(e))
        errors.append(f"validation: {e}")
        return {"errors": errors}

    logger.info("signal_validated", signal_id=state["signal_id"], trace_id=state["trace_id"])
    return {}
