"""Shared asyncpg connection pool for all Python-side Postgres writes."""

import os
from typing import Optional

import asyncpg
import structlog

logger = structlog.get_logger()

_pool: Optional[asyncpg.Pool] = None


async def get_pool() -> asyncpg.Pool:
    global _pool
    if _pool is None:
        dsn = os.getenv("DATABASE_URL", "postgresql://multiagent:localdev@localhost:5432/multiagent")
        _pool = await asyncpg.create_pool(dsn, min_size=2, max_size=10)
        logger.info("db_pool_created", dsn=dsn.split("@")[-1])  # log host only, not creds
    return _pool


async def close_pool() -> None:
    global _pool
    if _pool is not None:
        await _pool.close()
        _pool = None


async def health_check() -> bool:
    try:
        pool = await get_pool()
        async with pool.acquire() as conn:
            await conn.fetchval("SELECT 1")
        return True
    except Exception as exc:
        logger.error("db_health_check_failed", error=str(exc))
        return False
