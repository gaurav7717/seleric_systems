"""Shopify agent — run(context) -> AgentResult."""

import os
import time

from agents.shopify.src.parser import parse_response
from agents.shopify.src.tools import get_tool_definitions
from src.llm.client import chat_completion
from src.schemas.agent import AgentContext, AgentResult

AGENT_NAME = "shopify_agent"
SYSTEM_PROMPT = "You are a Shopify commerce specialist analyst."


async def run(context: AgentContext) -> AgentResult:
    start = time.monotonic()
    tools = get_tool_definitions(context.available_tools)

    if os.getenv("AGENT_STUB_MODE", "true").lower() == "true":
        return AgentResult(
            agent=AGENT_NAME,
            signal_id=context.signal_id,
            action_proposals=[],
            raw_response="stub",
            latency_ms=int((time.monotonic() - start) * 1000),
        )

    response = await chat_completion(
        system=SYSTEM_PROMPT,
        tools=tools or None,
        messages=[{"role": "user", "content": context.assembled_prompt}],
    )
    return parse_response(response, context, [], start)
