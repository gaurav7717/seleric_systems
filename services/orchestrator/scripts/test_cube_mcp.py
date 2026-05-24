"""
Test script — verify the Seleric MCP connection and fetch today's spend.

Run from services/orchestrator/:
    python scripts/test_cube_mcp.py
"""

import asyncio
import json
import os
import sys
import time
from datetime import date

# Fix Windows console Unicode
sys.stdout.reconfigure(encoding="utf-8", errors="replace")  # type: ignore

# Load .env from repo root (two levels up from scripts/)
from pathlib import Path
root = Path(__file__).parent.parent.parent.parent
sys.path.insert(0, str(Path(__file__).parent.parent))

from dotenv import load_dotenv
load_dotenv(root / ".env.local", override=False)
load_dotenv(root / ".env", override=False)


async def test_connection():
    """Step 1 — connect and list available tools."""
    from mcp import ClientSession
    from mcp.client.sse import sse_client
    from src.memory.cube_client import _auth_headers, _mcp_url

    url = _mcp_url()
    headers = _auth_headers()

    print(f"\n{'='*60}")
    print(f"MCP URL : {url}")
    print(f"Auth    : {'JWT from CUBEJS_API_SECRET' if 'Authorization' in headers else 'none'}")
    print(f"{'='*60}")

    print("\n[1/3] Connecting and listing tools...")
    async with sse_client(url, headers=headers) as (read, write):
        async with ClientSession(read, write) as session:
            await session.initialize()
            tools = await session.list_tools()
            names = [t.name for t in tools.tools]
            print(f"  Tools available: {names}")
            return names


async def test_today_spend():
    """Step 2 — call cube_daily_pnl for today's spend."""
    from mcp import ClientSession
    from mcp.client.sse import sse_client
    from src.memory.cube_client import _auth_headers, _mcp_url, _parse_mcp_result

    url = _mcp_url()
    headers = _auth_headers()

    today = date.today().isoformat()  # e.g. "2026-05-24"
    print(f"\n[2/3] Fetching today's P&L (cube_daily_pnl, start_date={today})...")
    async with sse_client(url, headers=headers) as (read, write):
        async with ClientSession(read, write) as session:
            await session.initialize()
            result = await session.call_tool("cube_daily_pnl", {"start_date": today})
            rows = _parse_mcp_result(result.content)

            if rows:
                print(f"  Rows returned: {len(rows)}")
                print(f"  First row:\n{json.dumps(rows[0], indent=4)}")
            else:
                print("  Raw content:")
                for block in result.content:
                    print(f"    {getattr(block, 'text', block)}")

            return rows


async def test_today_vs_yesterday():
    """Step 3 — call cube_pnl_today_yesterday."""
    from mcp import ClientSession
    from mcp.client.sse import sse_client
    from src.memory.cube_client import _auth_headers, _mcp_url, _parse_mcp_result

    url = _mcp_url()
    headers = _auth_headers()

    print("\n[3/3] Fetching today vs yesterday (cube_pnl_today_yesterday)...")
    async with sse_client(url, headers=headers) as (read, write):
        async with ClientSession(read, write) as session:
            await session.initialize()
            result = await session.call_tool("cube_pnl_today_yesterday", {})
            rows = _parse_mcp_result(result.content)

            if rows:
                print(f"  Rows returned: {len(rows)}")
                print(f"  First row:\n{json.dumps(rows[0], indent=4)}")
            else:
                print("  Raw content:")
                for block in result.content:
                    print(f"    {getattr(block, 'text', block)}")

            return rows


async def main():
    try:
        tool_names = await test_connection()

        if "cube_daily_pnl" in tool_names:
            await test_today_spend()
        else:
            print(f"\n  WARNING: cube_daily_pnl not found. Available: {tool_names}")

        if "cube_pnl_today_yesterday" in tool_names:
            await test_today_vs_yesterday()

        print("\nOK: MCP connection successful\n")

    except Exception as exc:
        print(f"\nFAILED: {exc}")
        import traceback
        traceback.print_exc()
        sys.exit(1)


if __name__ == "__main__":
    asyncio.run(main())
