"""Guardrail rule evaluation logic."""

from typing import Any

from agents.guardrail.src.rules_loader import load_rules


def _check_hard_blocks(proposal: dict[str, Any], rules: dict[str, Any]) -> dict[str, Any] | None:
    """Return a BLOCK result if any hard-block rule fires, else None.

    Note: write_disabled is enforced at execution time (Phase 3), not here — blocking
    write actions at classification time would prevent them from entering the approval queue.
    """
    budget_delta_thresholds = rules.get("thresholds", {}).get("budget_delta", {})
    queue_max_pct = float(budget_delta_thresholds.get("queue_max_pct", 50))

    rationale = proposal.get("rationale") or ""
    action_payload = proposal.get("action_payload") or {}
    budget_delta_pct = abs(float(action_payload.get("budget_delta_pct", 0)))

    if len(rationale.strip()) < 20:
        return {**proposal, "classification": "BLOCK", "guardrail_rule": "no_rationale"}

    if budget_delta_pct > queue_max_pct:
        return {**proposal, "classification": "BLOCK", "guardrail_rule": "budget_change_too_large"}

    return None


def classify_proposal(proposal: dict[str, Any], rules: dict[str, Any]) -> dict[str, Any]:
    # Hard blocks always take priority
    block = _check_hard_blocks(proposal, rules)
    if block is not None:
        return block

    risk = proposal.get("risk_level", "medium").lower()
    confidence = float(proposal.get("confidence", 0))

    thresholds = rules.get("thresholds", {})
    auto_min_confidence = float(thresholds.get("auto_min_confidence", 0.85))

    if risk == "high":
        return {**proposal, "classification": "QUEUE", "guardrail_rule": "high_risk_always_queue"}

    if confidence >= auto_min_confidence and risk == "low":
        return {**proposal, "classification": "AUTO", "guardrail_rule": "high_confidence_low_risk"}

    if risk == "medium":
        return {**proposal, "classification": "QUEUE", "guardrail_rule": "default_queue"}

    # low risk, low confidence — queue rather than auto
    return {**proposal, "classification": "QUEUE", "guardrail_rule": "low_confidence_queue"}
