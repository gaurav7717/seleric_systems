"""Shopify MCP read tool definitions + caller."""

import os
from typing import Any

import httpx

_TOOLS = [
    {
        "type": "function",
        "function": {
            "name": "get_inventory",
            "description": "Get current inventory levels for a product variant",
            "parameters": {
                "type": "object",
                "properties": {
                    "product_id": {"type": "string", "description": "Shopify product ID"},
                },
                "required": ["product_id"],
            },
        },
    },
    {
        "type": "function",
        "function": {
            "name": "get_product_orders",
            "description": "Get recent order velocity (units sold per day) for a product",
            "parameters": {
                "type": "object",
                "properties": {
                    "product_id": {"type": "string", "description": "Shopify product ID"},
                    "days": {"type": "integer", "description": "Lookback window in days", "default": 14},
                },
                "required": ["product_id"],
            },
        },
    },
    {
        "type": "function",
        "function": {
            "name": "get_product_details",
            "description": "Get product details including price, variants, tags, and status",
            "parameters": {
                "type": "object",
                "properties": {
                    "product_id": {"type": "string", "description": "Shopify product ID"},
                },
                "required": ["product_id"],
            },
        },
    },
]


def get_tool_definitions(allowed: list[str]) -> list[dict]:
    if allowed:
        return [t for t in _TOOLS if t["function"]["name"] in allowed]
    return _TOOLS


async def execute_tool(name: str, arguments: dict[str, Any], context: Any) -> Any:
    mcp_url = os.getenv("MCP_SHOPIFY_URL", "http://localhost:3100")
    async with httpx.AsyncClient(timeout=30.0) as client:
        response = await client.post(f"{mcp_url}/tools/{name}", json=arguments)
        response.raise_for_status()
        return response.json()
