"""Postgres write helpers for Signal and Insight records.

All writes use raw asyncpg (not Prisma) since Prisma is the JS/frontend ORM.
Enum values must be uppercased to match Prisma-generated Postgres enums.
"""

import json
from typing import Any

import asyncpg
import structlog

logger = structlog.get_logger()

# Maps API strings → Postgres enum values
_ENTITY_TYPE_MAP = {
    "campaign": "CAMPAIGN",
    "adset": "ADSET",
    "product": "PRODUCT",
    "store": "STORE",
}
_SEVERITY_MAP = {
    "critical": "CRITICAL",
    "warning": "WARNING",
    "info": "INFO",
}


async def save_signal(
    pool: asyncpg.Pool,
    signal_id: str,
    entity_type: str,
    entity_id: str,
    signal_type: str,
    context_snapshot: dict[str, Any],
    trace_id: str,
) -> None:
    entity_enum = _ENTITY_TYPE_MAP.get(entity_type.lower(), "CAMPAIGN")
    async with pool.acquire() as conn:
        await conn.execute(
            """
            INSERT INTO "Signal" (id, "entityType", "entityId", "signalType", "contextSnapshot", "traceId", "firedAt")
            VALUES ($1, $2::"EntityType", $3, $4, $5::jsonb, $6, NOW())
            ON CONFLICT (id) DO NOTHING
            """,
            signal_id,
            entity_enum,
            entity_id,
            signal_type,
            json.dumps(context_snapshot),
            trace_id,
        )
    logger.debug("signal_saved", signal_id=signal_id)


async def save_insight(
    pool: asyncpg.Pool,
    insight: dict[str, Any],
    signal_id: str,
) -> str:
    """Insert an InsightCard row (without embedding — embedding is async via worker)."""
    severity_enum = _SEVERITY_MAP.get(insight.get("severity", "info").lower(), "INFO")
    insight_id = insight["id"]

    async with pool.acquire() as conn:
        await conn.execute(
            """
            INSERT INTO "Insight" (id, "signalId", severity, title, what, why, evidence, confidence, agent, "createdAt")
            VALUES ($1, $2, $3::"InsightSeverity", $4, $5, $6, $7::jsonb, $8, $9, NOW())
            ON CONFLICT (id) DO NOTHING
            """,
            insight_id,
            signal_id,
            severity_enum,
            insight.get("title", "Insight")[:200],
            insight.get("what", ""),
            insight.get("why", ""),
            json.dumps(insight.get("evidence", [])),
            float(insight.get("confidence", 0.5)),
            insight.get("agent", "insight_agent"),
        )
    logger.debug("insight_saved", insight_id=insight_id, signal_id=signal_id)
    return insight_id
