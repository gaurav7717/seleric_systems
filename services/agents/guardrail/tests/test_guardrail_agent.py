import pytest

from agents.guardrail.src.agent import run
from agents.guardrail.src.classifier import classify_proposal
from agents.guardrail.src.rules_loader import load_rules
from src.schemas.agent import AgentContext


def test_high_risk_queues():
    rules = load_rules()
    result = classify_proposal(
        {
            "proposal_id": "p1",
            "risk_level": "high",
            "confidence": 0.99,
            "rationale": "ROAS dropped from 2.5 to 0.6 over 7 days, CPA doubled",
            "action_payload": {"budget_delta_pct": -10},
        },
        rules,
    )
    assert result["classification"] == "QUEUE"


def test_no_rationale_blocks():
    rules = load_rules()
    result = classify_proposal(
        {"proposal_id": "p2", "risk_level": "low", "confidence": 0.95, "rationale": "", "action_payload": {}},
        rules,
    )
    assert result["classification"] == "BLOCK"
    assert result["guardrail_rule"] == "no_rationale"


def test_large_budget_change_blocks():
    rules = load_rules()
    result = classify_proposal(
        {
            "proposal_id": "p3",
            "risk_level": "low",
            "confidence": 0.95,
            "rationale": "Campaign has been performing well consistently for 30 days",
            "action_payload": {"budget_delta_pct": -80},
        },
        rules,
    )
    assert result["classification"] == "BLOCK"
    assert result["guardrail_rule"] == "budget_change_too_large"


@pytest.mark.asyncio
async def test_guardrail_run_empty():
    context = AgentContext(
        signal_id="sig-1",
        entity_type="campaign",
        entity_id="c1",
        signal_type="roas_drop",
        assembled_prompt="",
    )
    assert await run(context, []) == []
