"""Pipeboard tool definitions + caller."""

from typing import Any

from src.tools.pipeboard import call_tool


def get_tool_definitions(allowed: list[str]) -> list[dict]:
    tools = [
        {
            "type": "function",
            "function": {
                "name": "get_campaign_performance",
                "description": "Fetch campaign performance from Pipeboard",
                "parameters": {
                    "type": "object",
                    "properties": {"campaign_id": {"type": "string"}},
                    "required": ["campaign_id"],
                },
            },
        }
    ]
    if allowed:
        return [t for t in tools if t["name"] in allowed]
    return tools


async def execute_tool(name: str, arguments: dict[str, Any], context: Any) -> Any:
    return await call_tool(name, arguments)
