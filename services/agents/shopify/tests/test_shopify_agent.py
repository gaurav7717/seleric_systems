import pytest

from agents.shopify.src.agent import run
from src.schemas.agent import AgentContext


@pytest.mark.asyncio
async def test_shopify_agent_stub():
    context = AgentContext(
        signal_id="sig-1",
        entity_type="product",
        entity_id="p1",
        signal_type="stock_critical",
        assembled_prompt="test",
    )
    result = await run(context)
    assert result.agent == "shopify_agent"
