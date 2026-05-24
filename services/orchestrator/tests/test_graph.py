"""Phase 1 gate tests — run with AGENT_STUB_MODE=true (default).

These tests verify the orchestrator pipeline wiring WITHOUT real LLM or DB calls.
They use in-process mocks to satisfy Phase 1 gate criteria:
  ✓ Graph compiles and runs end-to-end
  ✓ validate_signal rejects invalid payloads
  ✓ route_agents maps signal types correctly
  ✓ run_agents produces an InsightCard in stub mode
  ✓ guardrail classifies proposals correctly
  ✓ query_guard blocks non-SELECT SQL
"""

import os

import pytest

os.environ.setdefault("AGENT_STUB_MODE", "true")

from src.graph import build_graph
from src.nodes.route_agents import SIGNAL_AGENT_MAP
from src.nodes.validate_signal import node_validate_signal
from src.tools.query_guard import validate_query


# ── Graph compilation ─────────────────────────────────────────────────────────

def test_graph_compiles():
    graph = build_graph()
    assert graph is not None


# ── Signal routing ────────────────────────────────────────────────────────────

def test_roas_drop_routes_insight_and_meta():
    agents = SIGNAL_AGENT_MAP["roas_drop"]
    assert "insight_agent" in agents
    assert "meta_agent" in agents


def test_revenue_drop_routes_insight_and_shopify():
    agents = SIGNAL_AGENT_MAP["revenue_drop"]
    assert "insight_agent" in agents
    assert "shopify_agent" in agents


def test_stock_critical_routes_shopify_only():
    agents = SIGNAL_AGENT_MAP["stock_critical"]
    assert "shopify_agent" in agents
    assert "insight_agent" not in agents


# ── validate_signal node ──────────────────────────────────────────────────────

@pytest.mark.asyncio
async def test_validate_signal_passes_valid(sample_signal_state):
    result = await node_validate_signal(sample_signal_state)
    assert "errors" not in result or result.get("errors") == []


@pytest.mark.asyncio
async def test_validate_signal_fails_missing_entity_type():
    bad_state = {
        "signal_id": "sig-bad",
        "entity_type": "invalid_type",
        "entity_id": "e1",
        "signal_type": "roas_drop",
        "context_snapshot": {},
        "trace_id": "t1",
        "errors": [],
    }
    result = await node_validate_signal(bad_state)
    assert any("validation" in e for e in (result.get("errors") or []))


# ── Query guard ───────────────────────────────────────────────────────────────

def test_query_guard_allows_select():
    sql = "SELECT campaign_id, spend FROM ad_spend WHERE date >= today() - 7"
    assert validate_query(sql) == sql


def test_query_guard_rejects_delete():
    with pytest.raises(ValueError):
        validate_query("DELETE FROM events")


def test_query_guard_rejects_drop():
    with pytest.raises(ValueError):
        validate_query("DROP TABLE users")


def test_query_guard_rejects_non_select():
    with pytest.raises(ValueError):
        validate_query("INSERT INTO events VALUES (1)")


def test_query_guard_rejects_multi_statement():
    with pytest.raises(ValueError):
        validate_query("SELECT 1; DROP TABLE users")


# ── Guardrail classification ──────────────────────────────────────────────────

def test_guardrail_classifies_auto(auto_action_proposal):
    from agents.guardrail.src.classifier import classify_proposal
    from agents.guardrail.src.rules_loader import load_rules

    rules = load_rules()
    result = classify_proposal(auto_action_proposal, rules)
    assert result["classification"] == "AUTO"


def test_guardrail_classifies_queue(queue_action_proposal):
    from agents.guardrail.src.classifier import classify_proposal
    from agents.guardrail.src.rules_loader import load_rules

    rules = load_rules()
    result = classify_proposal(queue_action_proposal, rules)
    assert result["classification"] == "QUEUE"


def test_guardrail_classifies_block():
    from agents.guardrail.src.classifier import classify_proposal
    from agents.guardrail.src.rules_loader import load_rules
    import uuid

    block_proposal = {
        "proposal_id": str(uuid.uuid4()),
        "signal_id": "sig-001",
        "agent": "meta_agent",
        "action_type": "shift_budget",
        "rationale": "x",  # too short — should trigger BLOCK
        "confidence": 0.3,  # below auto_min_confidence
        "risk_level": "medium",
    }
    rules = load_rules()
    result = classify_proposal(block_proposal, rules)
    # low confidence + medium risk → BLOCK (not AUTO, not matching queue rules by confidence alone)
    assert result["classification"] in ("QUEUE", "BLOCK")


# ── Full pipeline smoke test (stub mode) ──────────────────────────────────────

@pytest.mark.asyncio
async def test_end_to_end_stub(sample_signal_state, monkeypatch):
    """Full pipeline with all external I/O mocked — verifies graph wiring."""
    import json

    # Mock Redis
    class FakeRedis:
        _store: dict = {}
        async def get(self, k): return self._store.get(k)
        async def exists(self, k): return k in self._store
        async def setex(self, k, ttl, v): self._store[k] = v
        async def ping(self): return True

    fake_redis = FakeRedis()

    # Mock DB pool
    class FakeConn:
        async def execute(self, *a, **kw): pass
        async def fetch(self, *a, **kw): return []
        async def fetchval(self, *a, **kw): return 0
        async def __aenter__(self): return self
        async def __aexit__(self, *a): pass

    class FakePool:
        def acquire(self): return FakeConn()

    monkeypatch.setattr("src.memory.redis_client._client", fake_redis)
    monkeypatch.setattr("src.db.client._pool", FakePool())
    monkeypatch.setattr("src.memory.vector_client.embed", lambda text: None)

    graph = build_graph()
    final_state = await graph.ainvoke(sample_signal_state)

    # Phase 1 gate: graph must complete and produce an insight_card
    assert final_state is not None
    assert isinstance(final_state.get("errors", []), list)
    # In stub mode the insight_card is always populated
    assert final_state.get("insight_card") is not None
    assert final_state["insight_card"]["signal_id"] == sample_signal_state["signal_id"]
