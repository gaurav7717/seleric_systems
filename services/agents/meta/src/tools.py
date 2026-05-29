"""Pipeboard read tool definitions + caller for Meta/Google Ads agent."""

from typing import Any

from src.tools.pipeboard import call_tool

_TOOLS = [
    {
        "type": "function",
        "function": {
            "name": "get_campaigns",
            "description": "List campaigns with performance summary (spend, ROAS, status)",
            "parameters": {
                "type": "object",
                "properties": {
                    "account_id": {"type": "string", "description": "Ad account ID"},
                    "limit": {"type": "integer", "description": "Max campaigns to return", "default": 10},
                },
                "required": [],
            },
        },
    },
    {
        "type": "function",
        "function": {
            "name": "get_campaign_insights",
            "description": "Fetch ROAS, spend, CPA, impressions for a campaign over a date range",
            "parameters": {
                "type": "object",
                "properties": {
                    "campaign_id": {"type": "string", "description": "Campaign ID"},
                    "date_preset": {
                        "type": "string",
                        "description": "Date range preset",
                        "enum": ["last_7d", "last_14d", "last_30d", "yesterday"],
                        "default": "last_7d",
                    },
                },
                "required": ["campaign_id"],
            },
        },
    },
    {
        "type": "function",
        "function": {
            "name": "get_adsets",
            "description": "List adsets under a campaign with bid strategy and daily budget",
            "parameters": {
                "type": "object",
                "properties": {
                    "campaign_id": {"type": "string", "description": "Parent campaign ID"},
                },
                "required": ["campaign_id"],
            },
        },
    },
]


def get_tool_definitions(allowed: list[str]) -> list[dict]:
    if allowed:
        return [t for t in _TOOLS if t["function"]["name"] in allowed]
    return _TOOLS


async def execute_tool(name: str, arguments: dict[str, Any], context: Any) -> Any:
    return await call_tool(name, arguments)
