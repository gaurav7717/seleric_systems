"""Guardrail agent — run(proposals) -> list[GuardrailResult dicts]."""

import structlog

from agents.guardrail.src.classifier import classify_proposal
from agents.guardrail.src.rules_loader import load_rules
from src.schemas.agent import AgentContext

logger = structlog.get_logger()
AGENT_NAME = "guardrail_agent"


async def run(context: AgentContext, proposals: list[dict]) -> list[dict]:
    rules = load_rules()
    results = [classify_proposal(p, rules) for p in proposals]
    logger.info(
        "guardrail_classified",
        signal_id=context.signal_id,
        count=len(results),
    )
    return results
