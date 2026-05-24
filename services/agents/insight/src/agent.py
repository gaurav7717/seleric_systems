"""Insight agent — run(context) -> AgentResult."""

import os
import time
import uuid
from datetime import datetime, timezone

import structlog

from agents.insight.src.parser import parse_response
from agents.insight.src.tools import get_tool_definitions
from src.llm.client import chat_completion
from src.schemas.agent import AgentContext, AgentResult

logger = structlog.get_logger()
AGENT_NAME = "insight_agent"
SYSTEM_PROMPT = "You are a business intelligence analyst. Diagnose signals with evidence."


async def run(context: AgentContext) -> AgentResult:
    start = time.monotonic()
    tools = get_tool_definitions(context.available_tools)

    if os.getenv("AGENT_STUB_MODE", "true").lower() == "true":
        insight = {
            "id": str(uuid.uuid4()),
            "signal_id": context.signal_id,
            "severity": "warning",
            "title": f"Signal detected: {context.signal_type}",
            "what": "Metrics shifted beyond expected range.",
            "why": "Stub mode — set LLM_MODEL + provider API key for live analysis.",
            "evidence": [str(context.current_metrics)],
            "confidence": 0.5,
            "agent": AGENT_NAME,
            "created_at": datetime.now(timezone.utc).isoformat(),
        }
        return AgentResult(
            agent=AGENT_NAME,
            signal_id=context.signal_id,
            insight=insight,
            raw_response="stub",
            latency_ms=int((time.monotonic() - start) * 1000),
        )

    response = await chat_completion(
        system=SYSTEM_PROMPT,
        tools=tools or None,
        messages=[{"role": "user", "content": context.assembled_prompt}],
    )
    return parse_response(response, context, [], start)
