"""Guardrail rule evaluation logic."""

from typing import Any

from agents.guardrail.src.rules_loader import load_rules


def classify_proposal(proposal: dict[str, Any], rules: dict[str, Any]) -> dict[str, Any]:
    risk = proposal.get("risk_level", "medium").lower()
    confidence = float(proposal.get("confidence", 0))

    thresholds = rules.get("thresholds", {})
    auto_min_confidence = float(thresholds.get("auto_min_confidence", 0.85))
    _queue_max_risk = thresholds.get("queue_max_risk", "medium")

    if risk == "high":
        return {
            **proposal,
            "classification": "QUEUE",
            "guardrail_rule": "high_risk_always_queue",
        }

    if confidence >= auto_min_confidence and risk == "low":
        return {
            **proposal,
            "classification": "AUTO",
            "guardrail_rule": "high_confidence_low_risk",
        }

    if risk in ("medium", _queue_max_risk):
        return {
            **proposal,
            "classification": "QUEUE",
            "guardrail_rule": "default_queue",
        }

    return {**proposal, "classification": "BLOCK", "guardrail_rule": "default_block"}
