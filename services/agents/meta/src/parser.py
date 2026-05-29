"""Parse LLM response -> list[ActionProposal] wrapped in AgentResult."""

import json
import re
import time
import uuid
from typing import Any

from src.schemas.agent import AgentContext, AgentResult

AGENT_NAME = "meta_agent"

_JSON_ARRAY_RE = re.compile(r"\[[\s\S]*\]", re.DOTALL)


def _extract_proposals(text: str) -> list[dict]:
    match = _JSON_ARRAY_RE.search(text)
    if not match:
        return []
    try:
        parsed = json.loads(match.group())
    except json.JSONDecodeError:
        return []
    return [p for p in parsed if isinstance(p, dict)]


def _normalise_proposal(raw: dict, context: AgentContext) -> dict:
    return {
        "proposal_id": str(uuid.uuid4()),
        "signal_id": context.signal_id,
        "entity_type": raw.get("entity_type", context.entity_type),
        "entity_id": raw.get("entity_id", context.entity_id),
        "agent": AGENT_NAME,
        "action_type": raw.get("action_type", "shift_budget"),
        "action_payload": raw.get("action_payload", {}),
        "rationale": raw.get("rationale", ""),
        "expected_outcome": raw.get("expected_outcome", ""),
        "confidence": float(raw.get("confidence", 0.5)),
        "risk_level": raw.get("risk_level", "medium"),
        "requires_approval": raw.get("risk_level", "medium") != "low",
    }


def parse_response(
    response: Any,
    context: AgentContext,
    tool_calls_log: list[dict],
    start: float,
) -> AgentResult:
    text = response.choices[0].message.content or ""
    raw_proposals = _extract_proposals(text)
    proposals = [_normalise_proposal(p, context) for p in raw_proposals]

    return AgentResult(
        agent=AGENT_NAME,
        signal_id=context.signal_id,
        action_proposals=proposals,
        raw_response=text,
        tool_calls_made=tool_calls_log,
        latency_ms=int((time.monotonic() - start) * 1000),
        tokens_used=getattr(response.usage, "completion_tokens", 0),
    )
