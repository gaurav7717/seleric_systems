"""API routes: /signal, /status/{trace_id}."""

import uuid

import structlog
from fastapi import APIRouter, HTTPException

from src.api.schemas import SignalResponseSchema, SignalSchema, StatusResponseSchema
from src.db.client import get_pool
from src.db.insight_store import save_signal
from src.graph import orchestrator_graph
from src.memory.redis_client import get_client as get_redis

logger = structlog.get_logger()
router = APIRouter()


@router.post("/signal", response_model=SignalResponseSchema)
async def receive_signal(payload: SignalSchema) -> SignalResponseSchema:
    trace_id = payload.trace_id or str(uuid.uuid4())
    redis = await get_redis()
    dedupe_key = f"signal:dedupe:{payload.signal_id}"

    if await redis.exists(dedupe_key):
        logger.info("duplicate_signal", signal_id=payload.signal_id, trace_id=trace_id)
        return SignalResponseSchema(status="duplicate", trace_id=trace_id)

    await redis.setex(dedupe_key, 3600, trace_id)

    # ── Persist the incoming signal to Postgres ───────────────────────────────
    try:
        pool = await get_pool()
        await save_signal(
            pool,
            signal_id=payload.signal_id,
            entity_type=payload.entity_type,
            entity_id=payload.entity_id,
            signal_type=payload.signal_type,
            context_snapshot=payload.context_snapshot,
            trace_id=trace_id,
        )
    except Exception as exc:
        # Signal persist failure is non-fatal — log and continue processing
        logger.warning("signal_persist_failed", signal_id=payload.signal_id, error=str(exc))

    initial_state = {
        "signal_id": payload.signal_id,
        "entity_type": payload.entity_type,
        "entity_id": payload.entity_id,
        "signal_type": payload.signal_type,
        "context_snapshot": payload.context_snapshot,
        "trace_id": trace_id,
        "errors": [],
    }

    await redis.setex(f"trace:{trace_id}:status", 86400, "running")

    try:
        final_state = await orchestrator_graph.ainvoke(initial_state)
        await redis.setex(f"trace:{trace_id}:status", 86400, "completed")
        await redis.setex(f"trace:{trace_id}:result", 86400, str(final_state))
        logger.info(
            "signal_processed",
            trace_id=trace_id,
            signal_id=payload.signal_id,
            errors=final_state.get("errors", []),
        )
    except Exception as exc:
        logger.error("signal_processing_failed", trace_id=trace_id, error=str(exc))
        await redis.setex(f"trace:{trace_id}:status", 86400, "failed")
        raise HTTPException(status_code=500, detail="Signal processing failed") from exc

    return SignalResponseSchema(status="accepted", trace_id=trace_id)


@router.get("/status/{trace_id}", response_model=StatusResponseSchema)
async def get_status(trace_id: str) -> StatusResponseSchema:
    redis = await get_redis()
    status = await redis.get(f"trace:{trace_id}:status")
    if not status:
        raise HTTPException(status_code=404, detail="Trace not found")

    return StatusResponseSchema(
        trace_id=trace_id,
        status=status.decode() if isinstance(status, bytes) else str(status),
    )
