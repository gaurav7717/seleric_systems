import pytest

from src.nodes.route_agents import SIGNAL_AGENT_MAP


def test_roas_drop_routes_insight_and_meta():
    agents = SIGNAL_AGENT_MAP["roas_drop"]
    assert "insight_agent" in agents
    assert "meta_agent" in agents
