"""dispatch_actions node — persist AUTO/QUEUE actions, enqueue jobs, and generate approval tokens."""

import base64
import hashlib
import hmac as _hmac
import os
from urllib.parse import urlparse

import structlog

from src.db.client import get_pool
from src.db.insight_store import save_pending_action
from src.state import OrchestratorState

logger = structlog.get_logger()

_APPROVAL_SECRET = os.getenv("APPROVAL_SECRET", "dev-secret-change-in-prod")
_APP_URL = os.getenv("NEXT_PUBLIC_APP_URL", "http://localhost:3000")


def _generate_approval_token(action_id: str, signal_id: str) -> str:
    msg = f"{action_id}:{signal_id}".encode()
    sig = _hmac.new(_APPROVAL_SECRET.encode(), msg, hashlib.sha256).digest()
    return base64.urlsafe_b64encode(sig).rstrip(b"=").decode()


def _redis_opts() -> dict:
    url = os.getenv("REDIS_URL", "redis://localhost:6379")
    parsed = urlparse(url)
    opts: dict = {"host": parsed.hostname or "localhost", "port": parsed.port or 6379}
    if parsed.password:
        opts["password"] = parsed.password
    return opts


async def _enqueue(queue_name: str, job_name: str, data: dict) -> None:
    """Push a BullMQ job from Python using the bullmq package."""
    from bullmq import Queue as BullQueue  # lazy import — not available in test env without Redis

    queue = BullQueue(queue_name, {"connection": _redis_opts()})
    try:
        await queue.add(job_name, data)
    finally:
        await queue.close()


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
            await _enqueue(
                "execute-action",
                "exec",
                {
                    "actionId": action_id,
                    "agent": action.get("agent"),
                    "actionType": action.get("action_type"),
                    "actionPayload": action.get("action_payload", {}),
                    "signalId": signal_id,
                    "entityId": state.get("entity_id"),
                    "entityType": state.get("entity_type"),
                },
            )
            logger.info(
                "auto_action_dispatched",
                trace_id=trace_id,
                action_id=action_id,
                action_type=action.get("action_type"),
            )
            execution_results.append({"action_id": action_id, "status": "queued"})
        except Exception as exc:
            logger.error("auto_action_dispatch_failed", trace_id=trace_id, error=str(exc))
            errors.append(f"dispatch_auto_action: {exc}")

    for action in queued_actions:
        try:
            action_id = await save_pending_action(pool, action, signal_id)

            # Generate HMAC approval token and persist it
            token = _generate_approval_token(action_id, signal_id)
            async with pool.acquire() as conn:
                await conn.execute(
                    'UPDATE "PendingAction" SET "approvalToken" = $1, "updatedAt" = NOW() WHERE id = $2',
                    token,
                    action_id,
                )

            approve_url = f"{_APP_URL}/api/approvals/{action_id}?token={token}&decision=approved"
            reject_url = f"{_APP_URL}/api/approvals/{action_id}?token={token}&decision=rejected"

            await _enqueue(
                "send-notification",
                "notify",
                {
                    "actionId": action_id,
                    "agent": action.get("agent"),
                    "actionType": action.get("action_type"),
                    "rationale": action.get("rationale", ""),
                    "expectedOutcome": action.get("expected_outcome", ""),
                    "confidence": action.get("confidence", 0.5),
                    "riskLevel": action.get("risk_level", "medium"),
                    "signalId": signal_id,
                    "signalType": state.get("signal_type"),
                    "entityId": state.get("entity_id"),
                    "entityType": state.get("entity_type"),
                    "approvalToken": token,
                    "approveUrl": approve_url,
                    "rejectUrl": reject_url,
                },
            )
            logger.info(
                "action_queued_for_approval",
                trace_id=trace_id,
                action_id=action_id,
                action_type=action.get("action_type"),
            )
        except Exception as exc:
            logger.error("queue_action_dispatch_failed", trace_id=trace_id, error=str(exc))
            errors.append(f"dispatch_queue_action: {exc}")

    return {"execution_results": execution_results, "errors": errors}
