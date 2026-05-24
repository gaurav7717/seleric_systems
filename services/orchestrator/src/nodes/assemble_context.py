"""assemble_context node — Redis + pgvector + Cube context fetch."""

import structlog
from jinja2 import Environment, FileSystemLoader, select_autoescape

from src.memory.cube_client import get_entity_metrics
from src.memory.redis_client import get_session
from src.memory.vector_client import search_similar_insights
from src.state import OrchestratorState

logger = structlog.get_logger()
_jinja = Environment(
    loader=FileSystemLoader("src/prompts"),
    autoescape=select_autoescape(default=False),
)


async def node_assemble_context(state: OrchestratorState) -> dict:
    errors = list(state.get("errors") or [])
    entity_id = state["entity_id"]
    trace_id = state["trace_id"]

    # Each step is independently fault-tolerant — partial context is better than no context.
    session_memory: dict = {}
    similar_insights: list = []
    current_metrics: dict = {}

    try:
        session_memory = await get_session(state["entity_type"], entity_id)
    except Exception as exc:
        logger.warning("session_fetch_failed", trace_id=trace_id, error=str(exc))

    try:
        similar_insights = await search_similar_insights(state["context_snapshot"])
    except Exception as exc:
        logger.warning("vector_search_failed", trace_id=trace_id, error=str(exc))

    try:
        current_metrics = await get_entity_metrics(entity_id, state["entity_type"])
    except Exception as exc:
        logger.warning("cube_fetch_failed", trace_id=trace_id, error=str(exc))

    try:
        template = _jinja.get_template("insight.j2")
        assembled_prompt = template.render(
            signal_type=state["signal_type"],
            entity_type=state["entity_type"],
            entity_id=entity_id,
            context_snapshot=state["context_snapshot"],
            session_memory=session_memory,
            similar_insights=similar_insights,
            current_metrics=current_metrics,
        )
    except Exception as exc:
        logger.error("prompt_render_failed", trace_id=trace_id, error=str(exc))
        errors.append(f"context_assembly_critical: {exc}")
        return {"errors": errors}

    logger.info(
        "context_assembled",
        trace_id=trace_id,
        has_session=bool(session_memory),
        similar_count=len(similar_insights),
        has_metrics=bool(current_metrics),
    )

    return {
        "session_memory": session_memory,
        "similar_insights": similar_insights,
        "current_metrics": current_metrics,
        "assembled_prompt": assembled_prompt,
    }
