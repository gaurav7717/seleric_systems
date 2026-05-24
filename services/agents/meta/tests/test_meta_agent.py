import pytest

from agents.meta.src.agent import AGENT_NAME, run
from src.schemas.agent import AgentContext


@pytest.mark.asyncio
async def test_meta_agent_stub():
    context = AgentContext(
        signal_id="sig-1",
        entity_type="campaign",
        entity_id="c1",
        signal_type="roas_drop",
        assembled_prompt="test",
    )
    result = await run(context)
    assert result.agent == AGENT_NAME
