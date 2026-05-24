"""parse_response() -> AgentResult with InsightCard.

The insight prompt asks the model to return a JSON object.
We try to parse it; fall back to a plain-text card if parsing fails.
"""

import json
import re
import time
import uuid
from datetime import datetime, timezone
from typing import Any

from src.schemas.agent import AgentContext, AgentResult

AGENT_NAME = "insight_agent"

_JSON_RE = re.compile(r"\{[\s\S]*\}", re.DOTALL)


def _extract_json(text: str) -> dict | None:
    match = _JSON_RE.search(text)
    if not match:
        return None
    try:
        return json.loads(match.group())
    except json.JSONDecodeError:
        return None


def parse_response(
    response: Any,
    context: AgentContext,
    tool_calls_log: list[dict],
    start: float,
) -> AgentResult:
    # LiteLLM returns OpenAI-format responses regardless of provider
    text = response.choices[0].message.content or ""

    parsed = _extract_json(text)

    insight: dict[str, Any] = {
        "id": str(uuid.uuid4()),
        "signal_id": context.signal_id,
        "severity": "info",
        "title": "Insight generated",
        "what": text[:200] or "Analysis complete.",
        "why": "See model response.",
        "evidence": [],
        "confidence": 0.5,
        "agent": AGENT_NAME,
        "created_at": datetime.now(timezone.utc).isoformat(),
    }

    if parsed:
        insight.update(
            {
                "severity": parsed.get("severity", "info"),
                "title": str(parsed.get("title", insight["title"]))[:80],
                "what": parsed.get("what", insight["what"]),
                "why": parsed.get("why", insight["why"]),
                "evidence": parsed.get("evidence", []),
                "confidence": float(parsed.get("confidence", 0.5)),
            }
        )

    return AgentResult(
        agent=AGENT_NAME,
        signal_id=context.signal_id,
        insight=insight,
        raw_response=text,
        tool_calls_made=tool_calls_log,
        latency_ms=int((time.monotonic() - start) * 1000),
        tokens_used=getattr(response.usage, "completion_tokens", 0),
    )
