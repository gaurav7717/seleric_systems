"""Shopify MCP tool definitions + caller."""

import os
from typing import Any

import httpx


def get_tool_definitions(allowed: list[str]) -> list[dict]:
    tools = [
        {
            "type": "function",
            "function": {
                "name": "get_inventory",
                "description": "Get product inventory levels",
                "parameters": {
                    "type": "object",
                    "properties": {"product_id": {"type": "string"}},
                    "required": ["product_id"],
                },
            },
        }
    ]
    if allowed:
        return [t for t in tools if t["name"] in allowed]
    return tools


async def execute_tool(name: str, arguments: dict[str, Any], context: Any) -> Any:
    mcp_url = os.getenv("MCP_SHOPIFY_URL", "http://localhost:3100")
    async with httpx.AsyncClient(timeout=30.0) as client:
        response = await client.post(f"{mcp_url}/tools/{name}", json=arguments)
        response.raise_for_status()
        return response.json()
