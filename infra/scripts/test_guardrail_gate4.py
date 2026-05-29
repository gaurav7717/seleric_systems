"""Phase 2 Gate 4: guardrail produces 1 AUTO, 1 QUEUE, 1 BLOCK."""
import os
import sys

# Set up paths
repo = os.path.dirname(os.path.dirname(os.path.dirname(os.path.abspath(__file__))))
sys.path.insert(0, os.path.join(repo, "services", "orchestrator"))
sys.path.insert(0, os.path.join(repo, "services", "agents"))
os.chdir(repo)

from agents.guardrail.src.classifier import classify_proposal
from agents.guardrail.src.rules_loader import load_rules

rules = load_rules()

proposals = [
    {
        "proposal_id": "p2-auto",
        "signal_id": "sig-p2",
        "entity_type": "adset",
        "entity_id": "adset-001",
        "agent": "meta_agent",
        "action_type": "shift_budget",
        "action_payload": {"budget_delta_pct": -5},
        "rationale": "ROAS dropped from 2.1 to 0.8 over 7 days, CPA is 120 vs target 50",
        "expected_outcome": "Reduce wasted spend by 5%, saving ~150 USD/week",
        "confidence": 0.90,
        "risk_level": "low",
        "requires_approval": False,
    },
    {
        "proposal_id": "p2-queue",
        "signal_id": "sig-p2",
        "entity_type": "campaign",
        "entity_id": "camp-001",
        "agent": "meta_agent",
        "action_type": "shift_budget",
        "action_payload": {"budget_delta_pct": -25},
        "rationale": "Campaign ROAS at 0.7 for 3 days, spend is 6000 USD/week above target",
        "expected_outcome": "Reduce spend by 25% to 4500 USD/week while maintaining reach",
        "confidence": 0.72,
        "risk_level": "medium",
        "requires_approval": True,
    },
    {
        "proposal_id": "p2-block",
        "signal_id": "sig-p2",
        "entity_type": "campaign",
        "entity_id": "camp-002",
        "agent": "meta_agent",
        "action_type": "shift_budget",
        "action_payload": {"budget_delta_pct": -80},
        "rationale": "Pause spend",
        "expected_outcome": "Stop spend",
        "confidence": 0.85,
        "risk_level": "low",
        "requires_approval": False,
    },
]

results = [classify_proposal(p, rules) for p in proposals]

print("\nGuardrail classification results:")
for r in results:
    print("  {}: {} ({})".format(r["proposal_id"], r["classification"], r.get("guardrail_rule", "?")))

classes = [r["classification"] for r in results]
assert "AUTO" in classes, "FAIL: No AUTO in {}".format(classes)
assert "QUEUE" in classes, "FAIL: No QUEUE in {}".format(classes)
assert "BLOCK" in classes, "FAIL: No BLOCK in {}".format(classes)

print("\nPhase 2 Gate 4 PASSED -- 1 AUTO, 1 QUEUE, 1 BLOCK")
