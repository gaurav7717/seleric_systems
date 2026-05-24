"""pgvector similarity search + insight insert.

Embedding is generated via LiteLLM (see llm/client.py).
If embedding is unavailable (model doesn't support it, or EMBEDDING_MODEL not set),
similarity search falls back to recency order — still functionally correct for Phase 1.
"""

from typing import Any

import structlog

from src.db.client import get_pool
from src.llm.client import embed

logger = structlog.get_logger()


def _snapshot_to_text(context_snapshot: dict[str, Any]) -> str:
    """Convert a context snapshot dict to a plain text string for embedding."""
    parts = []
    for k, v in context_snapshot.items():
        parts.append(f"{k}: {v}")
    return " ".join(parts)


async def search_similar_insights(
    context_snapshot: dict[str, Any],
    limit: int = 5,
) -> list[dict]:
    pool = await get_pool()
    text = _snapshot_to_text(context_snapshot)
    vector = await embed(text)

    async with pool.acquire() as conn:
        if vector is not None:
            # Real cosine similarity search via pgvector
            vector_str = "[" + ",".join(str(v) for v in vector) + "]"
            rows = await conn.fetch(
                """
                SELECT id, title, what, why, confidence, "createdAt"
                FROM "Insight"
                WHERE embedding IS NOT NULL
                ORDER BY embedding <=> $1::vector
                LIMIT $2
                """,
                vector_str,
                limit,
            )
        else:
            # Fallback: most recent insights when embedding is unavailable
            logger.debug("vector_search_fallback_to_recency")
            rows = await conn.fetch(
                """
                SELECT id, title, what, why, confidence, "createdAt"
                FROM "Insight"
                ORDER BY "createdAt" DESC
                LIMIT $1
                """,
                limit,
            )

    return [dict(row) for row in rows]


async def insert_insight(insight: dict[str, Any]) -> None:
    """Insert insight without embedding — embedding is added async by the worker."""
    from src.db.insight_store import save_insight

    pool = await get_pool()
    await save_insight(pool, insight, insight["signal_id"])


async def health_check() -> bool:
    try:
        pool = await get_pool()
        async with pool.acquire() as conn:
            await conn.fetchval('SELECT COUNT(*) FROM "Insight"')
        return True
    except Exception as exc:
        logger.error("vector_client_health_check_failed", error=str(exc))
        return False
