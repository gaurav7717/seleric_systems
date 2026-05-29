"""Insight agent — run(context) -> AgentResult."""

import os
import time
import uuid
from datetime import datetime, timezone

import structlog

from agents.insight.src.parser import parse_response
from src.llm.client import chat_completion
from src.schemas.agent import AgentContext, AgentResult

logger = structlog.get_logger()
AGENT_NAME = "insight_agent"
SYSTEM_PROMPT = (
    "You are a business intelligence analyst. Diagnose the signal using the evidence provided.\n"
    "Respond with ONLY a single JSON object (no prose, no markdown fences) of the form:\n"
    '{"severity": "critical|warning|info", "title": "<=80 char headline", '
    '"what": "what changed, with numbers", "why": "the likely cause", '
    '"evidence": ["fact 1", "fact 2"], "confidence": 0.0-1.0}'
)


async def run(context: AgentContext) -> AgentResult:
    start = time.monotonic()

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

    # Diagnosis is a single-shot, tools-free step: the model returns a JSON insight
    # directly. (No tool-call loop exists here, so passing tools left content empty.)
    response = await chat_completion(
        system=SYSTEM_PROMPT,
        messages=[{"role": "user", "content": context.assembled_prompt}],
    )
    return parse_response(response, context, [], start)
