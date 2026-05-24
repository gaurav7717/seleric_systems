"""Pipeboard MCP HTTP client."""

import os
from typing import Any

import httpx


async def call_tool(tool_name: str, arguments: dict[str, Any]) -> Any:
    base_url = os.getenv("PIPEBOARD_MCP_URL", "https://meta-ads.mcp.pipeboard.co")
    token = os.getenv("PIPEBOARD_TOKEN", "")

    async with httpx.AsyncClient(timeout=60.0) as client:
        response = await client.post(
            f"{base_url.rstrip('/')}/tools/{tool_name}",
            json=arguments,
            headers={"Authorization": f"Bearer {token}"} if token else {},
        )
        response.raise_for_status()
        return response.json()
