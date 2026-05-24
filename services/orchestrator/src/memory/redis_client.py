"""Redis session read/write/cache."""

import json
import os
from typing import Any, Optional

import redis.asyncio as redis
import structlog

logger = structlog.get_logger()

_client: Optional[redis.Redis] = None

_SESSION_TTL = 86_400  # 24 h


async def get_client() -> redis.Redis:
    global _client
    if _client is None:
        url = os.getenv("REDIS_URL", "redis://localhost:6379")
        _client = redis.from_url(url, decode_responses=False)
    return _client


def _session_key(entity_type: str, entity_id: str) -> str:
    return f"entity:{entity_type}:{entity_id}:session"


async def get_session(entity_type: str, entity_id: str) -> dict[str, Any]:
    client = await get_client()
    raw = await client.get(_session_key(entity_type, entity_id))
    if not raw:
        return {}
    return json.loads(raw.decode() if isinstance(raw, bytes) else raw)


async def set_session(
    entity_type: str,
    entity_id: str,
    data: dict[str, Any],
    ttl: int = _SESSION_TTL,
) -> None:
    client = await get_client()
    await client.setex(_session_key(entity_type, entity_id), ttl, json.dumps(data))


async def merge_session(
    entity_type: str,
    entity_id: str,
    updates: dict[str, Any],
    ttl: int = _SESSION_TTL,
) -> dict[str, Any]:
    """Read-merge-write session. Returns the merged result."""
    current = await get_session(entity_type, entity_id)
    merged = {**current, **updates}
    await set_session(entity_type, entity_id, merged, ttl)
    return merged


async def health_check() -> bool:
    try:
        client = await get_client()
        await client.ping()
        return True
    except Exception as exc:
        logger.error("redis_health_check_failed", error=str(exc))
        return False
