"""parse -> list[ActionProposal] wrapped in AgentResult."""

import time
from typing import Any

from src.schemas.agent import AgentContext, AgentResult

AGENT_NAME = "meta_agent"


def parse_response(
    response: Any,
    context: AgentContext,
    tool_calls_log: list[dict],
    start: float,
) -> AgentResult:
    # LiteLLM returns OpenAI-format responses regardless of provider
    text = response.choices[0].message.content or ""

    return AgentResult(
        agent=AGENT_NAME,
        signal_id=context.signal_id,
        action_proposals=[],
        raw_response=text,
        tool_calls_made=tool_calls_log,
        latency_ms=int((time.monotonic() - start) * 1000),
        tokens_used=getattr(response.usage, "completion_tokens", 0),
    )
