"""Tool definitions + execute_tool for insight agent."""

from typing import Any


def get_tool_definitions(allowed: list[str]) -> list[dict]:
    tools = [
        {
            "type": "function",
            "function": {
                "name": "query_clickhouse",
                "description": "Run a read-only ClickHouse query",
                "parameters": {
                    "type": "object",
                    "properties": {"sql": {"type": "string"}},
                    "required": ["sql"],
                },
            },
        }
    ]
    if allowed:
        return [t for t in tools if t["name"] in allowed]
    return tools


async def execute_tool(name: str, arguments: dict[str, Any], context: Any) -> Any:
    if name == "query_clickhouse":
        from src.tools.clickhouse import execute_query

        return await execute_query(arguments["sql"])
    raise ValueError(f"Unknown tool: {name}")
