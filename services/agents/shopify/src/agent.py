"""Shopify agent — run(context) -> AgentResult with ActionProposals."""

import json
import os
import time

import structlog
from jinja2 import Environment, FileSystemLoader, select_autoescape

from agents.shopify.src.parser import parse_response
from agents.shopify.src.tools import execute_tool, get_tool_definitions
from src.llm.client import chat_completion
from src.schemas.agent import AgentContext, AgentResult

logger = structlog.get_logger()
AGENT_NAME = "shopify_agent"
SYSTEM_PROMPT = (
    "You are a Shopify commerce specialist analyst. "
    "You diagnose product and inventory signals and propose precise, data-backed actions. "
    "Always include velocity analysis (units/day, days of stock remaining). "
    "Return only valid JSON."
)

_jinja = Environment(
    loader=FileSystemLoader("src/prompts"),
    autoescape=select_autoescape(default=False),
)


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

    template = _jinja.get_template("shopify.j2")
    prompt = template.render(
        signal_type=context.signal_type,
        entity_type=context.entity_type,
        entity_id=context.entity_id,
        context_snapshot=context.context_snapshot,
        current_metrics=context.current_metrics,
        session_memory=context.session_memory or {},
        similar_insights=context.similar_insights or [],
    )

    messages = [{"role": "user", "content": prompt}]
    tool_calls_log: list[dict] = []

    for _ in range(3):
        response = await chat_completion(
            system=SYSTEM_PROMPT,
            tools=tools or None,
            messages=messages,
        )
        msg = response.choices[0].message
        raw_tool_calls = getattr(msg, "tool_calls", None)

        if not raw_tool_calls:
            break

        messages.append(msg)
        for tc in raw_tool_calls:
            tc_args: dict = {}
            tc_result: dict = {}
            try:
                tc_args = json.loads(tc.function.arguments)
                tc_result = await execute_tool(tc.function.name, tc_args, context)
            except Exception as exc:
                tc_result = {"error": str(exc)}

            tool_calls_log.append({"name": tc.function.name, "args": tc_args, "result": tc_result})
            messages.append({
                "role": "tool",
                "tool_call_id": tc.id,
                "content": json.dumps(tc_result),
            })

    return parse_response(response, context, tool_calls_log, start)
