"""Cube metrics via the hosted Seleric MCP server (SSE transport).

Real schema discovered from the live MCP server:
  Cube:       daily_pnl
  Measures:   daily_pnl.total_ad_spend, daily_pnl.gross_revenue,
              daily_pnl.net_profit, daily_pnl.gross_profit,
              daily_pnl.total_sales_ex_gst, daily_pnl.total_cogs,
              daily_pnl.total_orders
  Dimension:  daily_pnl.report_date  (IST timezone)
  Tools:      cube_daily_pnl (start_date: str)
              cube_pnl_today_yesterday ()
              cube_channel_pnl ()
              cube_query (query: dict)
              cube_meta ()

Auth: CUBEJS_API_SECRET → HS256 JWT (SELERIC_API_KEY if set overrides)
"""

import json
import os
import time
from datetime import date, timedelta
from typing import Any

import structlog

logger = structlog.get_logger()

_EMPTY_METRICS: dict[str, Any] = {
    "spend_7d": None,
    "spend_30d": None,
    "revenue_7d": None,
    "revenue_30d": None,
    "net_profit_7d": None,
    "net_profit_30d": None,
    "orders_7d": None,
    "orders_30d": None,
    "today_spend": None,
    "today_revenue": None,
    "today_net_profit": None,
    "today_orders": None,
}


def _mcp_url() -> str:
    return os.getenv("CUBE_MCP_URL", "https://mcp.seleric.com/sse")


def _auth_headers() -> dict[str, str]:
    api_key = os.getenv("SELERIC_API_KEY", "")
    if api_key:
        return {"Authorization": f"Bearer {api_key}"}
    secret = os.getenv("CUBEJS_API_SECRET", "")
    if secret:
        import jwt  # PyJWT
        token = jwt.encode(
            {"iat": int(time.time()), "exp": int(time.time()) + 3600},
            secret,
            algorithm="HS256",
        )
        return {"Authorization": f"Bearer {token}"}
    return {}


def _parse_mcp_result(content: list) -> list[dict]:
    for block in content:
        text = getattr(block, "text", None)
        if not text:
            continue
        try:
            parsed = json.loads(text)
            if isinstance(parsed, list):
                return parsed
            if isinstance(parsed, dict):
                # cube_query returns full Cube response with "data" key
                return parsed.get("data", [parsed])
        except (json.JSONDecodeError, AttributeError):
            pass
    return []


def _sum_rows(rows: list[dict], measure: str) -> float | None:
    """Sum a measure across multiple daily rows."""
    values = []
    for row in rows:
        v = row.get(measure)
        if v is not None:
            try:
                values.append(float(v))
            except (ValueError, TypeError):
                pass
    return round(sum(values), 2) if values else None


async def get_today_spend() -> dict[str, Any]:
    """Call cube_daily_pnl for today's spend."""
    from mcp import ClientSession
    from mcp.client.sse import sse_client

    today = date.today().isoformat()
    try:
        async with sse_client(_mcp_url(), headers=_auth_headers()) as (read, write):
            async with ClientSession(read, write) as session:
                await session.initialize()
                result = await session.call_tool("cube_daily_pnl", {"start_date": today})
                rows = _parse_mcp_result(result.content)
                logger.info("cube_daily_pnl_result", row_count=len(rows))
                return {"today_pnl": rows}
    except Exception as exc:
        logger.error("cube_daily_pnl_failed", error=str(exc))
        return {}


async def get_entity_metrics(entity_id: str, entity_type: str = "campaign") -> dict[str, Any]:
    """Fetch aggregated metrics for 7d, 30d windows plus today via cube_query."""
    from mcp import ClientSession
    from mcp.client.sse import sse_client

    url = _mcp_url()
    metrics: dict[str, Any] = {"entity_id": entity_id}

    _MEASURES = [
        "daily_pnl.total_ad_spend",
        "daily_pnl.gross_revenue",
        "daily_pnl.net_profit",
        "daily_pnl.gross_profit",
        "daily_pnl.total_sales_ex_gst",
        "daily_pnl.total_cogs",
        "daily_pnl.total_orders",
    ]

    try:
        async with sse_client(url, headers=_auth_headers()) as (read, write):
            async with ClientSession(read, write) as session:
                await session.initialize()

                # Today via cube_daily_pnl
                today = date.today().isoformat()
                try:
                    result = await session.call_tool("cube_daily_pnl", {"start_date": today})
                    rows = _parse_mcp_result(result.content)
                    if rows:
                        r = rows[0]
                        metrics["today_spend"] = _sum_rows(rows, "daily_pnl.total_ad_spend")
                        metrics["today_revenue"] = _sum_rows(rows, "daily_pnl.gross_revenue")
                        metrics["today_net_profit"] = _sum_rows(rows, "daily_pnl.net_profit")
                        metrics["today_orders"] = _sum_rows(rows, "daily_pnl.total_orders")
                except Exception as exc:
                    logger.warning("cube_today_fetch_failed", error=str(exc))

                # 7d and 30d aggregated via cube_query
                for days, suffix in [(7, "7d"), (30, "30d")]:
                    start = (date.today() - timedelta(days=days)).isoformat()
                    try:
                        result = await session.call_tool(
                            "cube_query",
                            {
                                "query": {
                                    "measures": _MEASURES,
                                    "timeDimensions": [
                                        {
                                            "dimension": "daily_pnl.report_date",
                                            "granularity": "day",
                                            "dateRange": [start, today],
                                        }
                                    ],
                                    "timezone": "Asia/Kolkata",
                                }
                            },
                        )
                        rows = _parse_mcp_result(result.content)
                        metrics[f"spend_{suffix}"] = _sum_rows(rows, "daily_pnl.total_ad_spend")
                        metrics[f"revenue_{suffix}"] = _sum_rows(rows, "daily_pnl.gross_revenue")
                        metrics[f"net_profit_{suffix}"] = _sum_rows(rows, "daily_pnl.net_profit")
                        metrics[f"orders_{suffix}"] = _sum_rows(rows, "daily_pnl.total_orders")
                    except Exception as exc:
                        logger.warning("cube_period_fetch_failed", suffix=suffix, error=str(exc))
                        for key in ("spend", "revenue", "net_profit", "orders"):
                            metrics.setdefault(f"{key}_{suffix}", None)

    except Exception as exc:
        logger.error("cube_mcp_connection_failed", url=url, error=str(exc))
        return {**_EMPTY_METRICS, "entity_id": entity_id}

    return metrics


async def health_check() -> bool:
    from mcp import ClientSession
    from mcp.client.sse import sse_client

    try:
        async with sse_client(_mcp_url(), headers=_auth_headers()) as (read, write):
            async with ClientSession(read, write) as session:
                await session.initialize()
                tools = await session.list_tools()
                tool_names = [t.name for t in tools.tools]
                logger.info("cube_mcp_tools", tools=tool_names)
                return True
    except Exception as exc:
        logger.error("cube_mcp_health_check_failed", error=str(exc))
        return False
