"""ClickHouse query tool definition + executor."""

import os
from typing import Any

import httpx

from src.tools.query_guard import validate_query


async def execute_query(sql: str) -> list[dict[str, Any]]:
    safe_sql = validate_query(sql)
    url = os.getenv("CLICKHOUSE_URL", "")
    if not url:
        return []

    async with httpx.AsyncClient(timeout=60.0) as client:
        response = await client.post(
            url,
            params={"database": os.getenv("CLICKHOUSE_DATABASE", "analytics")},
            auth=(
                os.getenv("CLICKHOUSE_USER", "default"),
                os.getenv("CLICKHOUSE_PASSWORD", ""),
            ),
            content=safe_sql,
        )
        response.raise_for_status()
        return response.json().get("data", [])
