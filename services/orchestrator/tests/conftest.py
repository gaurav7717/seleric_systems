import sys
from pathlib import Path

# Make agents/ and src/ importable without setting PYTHONPATH manually
_services = Path(__file__).parent.parent.parent  # services/
_orchestrator = Path(__file__).parent.parent     # services/orchestrator

for _p in (_orchestrator, _services / "agents", _services):
    if str(_p) not in sys.path:
        sys.path.insert(0, str(_p))

import pytest


@pytest.fixture
def sample_signal_state() -> dict:
    return {
        "signal_id": "sig-test-001",
        "entity_type": "campaign",
        "entity_id": "camp_123",
        "signal_type": "roas_drop",
        "context_snapshot": {"roas_7d": 1.2, "roas_prev_7d": 2.1, "spend_7d": 4500.0},
        "trace_id": "trace-test-001",
        "errors": [],
    }


@pytest.fixture
def sample_insight() -> dict:
    from datetime import datetime, timezone
    import uuid

    return {
        "id": str(uuid.uuid4()),
        "signal_id": "sig-test-001",
        "severity": "warning",
        "title": "ROAS dropped 43% week-over-week",
        "what": "Campaign ROAS fell from 2.1 to 1.2 over 7 days.",
        "why": "Likely audience fatigue — CPM rising while conversion rate held flat.",
        "evidence": ["ROAS: 1.2 vs 2.1 prior week", "Spend: $4,500 (unchanged)"],
        "confidence": 0.75,
        "agent": "insight_agent",
        "created_at": datetime.now(timezone.utc).isoformat(),
    }


@pytest.fixture
def auto_action_proposal() -> dict:
    import uuid

    return {
        "proposal_id": str(uuid.uuid4()),
        "signal_id": "sig-test-001",
        "entity_type": "campaign",
        "entity_id": "camp_123",
        "agent": "meta_agent",
        "action_type": "shift_budget",
        "action_payload": {"campaign_id": "camp_123", "budget_delta_pct": -8},
        "rationale": "ROAS below 1.5 threshold for 72h; reducing spend to limit losses.",
        "expected_outcome": "Expected to reduce daily loss by ~$300 over 7 days.",
        "confidence": 0.88,
        "risk_level": "low",
        "requires_approval": False,
        "budget_delta_pct": -8,
    }


@pytest.fixture
def queue_action_proposal() -> dict:
    import uuid

    return {
        "proposal_id": str(uuid.uuid4()),
        "signal_id": "sig-test-001",
        "entity_type": "campaign",
        "entity_id": "camp_123",
        "agent": "meta_agent",
        "action_type": "shift_budget",
        "action_payload": {"campaign_id": "camp_123", "budget_delta_pct": 25},
        "rationale": "Scale up spend following ROAS recovery above 2.5.",
        "expected_outcome": "Expected to increase revenue by ~$2,000 over next 14 days.",
        "confidence": 0.70,
        "risk_level": "high",
        "requires_approval": True,
        "budget_delta_pct": 25,
    }
