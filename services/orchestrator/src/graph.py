"""
graph.py — LangGraph StateGraph wiring.
This is the ONLY file where nodes and edges are connected.
To add a new agent: add it to SIGNAL_AGENT_MAP and create a new node in nodes/.
"""

import structlog
from langgraph.graph import END, StateGraph

from src.nodes.assemble_context import node_assemble_context
from src.nodes.dispatch_actions import node_dispatch_actions
from src.nodes.guardrail import node_guardrail
from src.nodes.persist_results import node_persist_results
from src.nodes.route_agents import node_route_agents
from src.nodes.run_agents import node_run_agents
from src.nodes.validate_signal import node_validate_signal
from src.state import OrchestratorState

logger = structlog.get_logger()


def should_continue_after_validation(state: OrchestratorState) -> str:
    if state.get("errors") and any("validation" in e for e in state["errors"]):
        return "end"
    if state.get("errors") and any("duplicate" in e for e in state["errors"]):
        return "end"
    return "assemble_context"


def should_continue_after_context(state: OrchestratorState) -> str:
    if state.get("errors") and any("context_assembly_critical" in e for e in state["errors"]):
        return "end"
    return "route_agents"


def should_run_agents(state: OrchestratorState) -> str:
    if not state.get("agents_to_run"):
        logger.warning("no_agents_for_signal", signal_type=state["signal_type"])
        return "end"
    return "run_agents"


def should_dispatch_after_guardrail(state: OrchestratorState) -> str:
    if state.get("auto_actions"):
        return "dispatch_actions"
    return "end"


def build_graph() -> StateGraph:
    graph = StateGraph(OrchestratorState)

    # ── Register nodes ───────────────────────────────────────────────────────
    graph.add_node("validate_signal", node_validate_signal)
    graph.add_node("assemble_context", node_assemble_context)
    graph.add_node("route_agents", node_route_agents)
    graph.add_node("run_agents", node_run_agents)
    graph.add_node("persist_results", node_persist_results)
    graph.add_node("guardrail", node_guardrail)
    graph.add_node("dispatch_actions", node_dispatch_actions)

    # ── Entry point ──────────────────────────────────────────────────────────
    graph.set_entry_point("validate_signal")

    # ── Edges ────────────────────────────────────────────────────────────────
    graph.add_conditional_edges(
        "validate_signal",
        should_continue_after_validation,
        {"assemble_context": "assemble_context", "end": END},
    )
    graph.add_conditional_edges(
        "assemble_context",
        should_continue_after_context,
        {"route_agents": "route_agents", "end": END},
    )
    graph.add_conditional_edges(
        "route_agents",
        should_run_agents,
        {"run_agents": "run_agents", "end": END},
    )
    graph.add_edge("run_agents", "persist_results")   # save InsightCard before guardrail
    graph.add_edge("persist_results", "guardrail")
    graph.add_conditional_edges(
        "guardrail",
        should_dispatch_after_guardrail,
        {"dispatch_actions": "dispatch_actions", "end": END},
    )
    graph.add_edge("dispatch_actions", END)

    return graph.compile()


# Compile once at import time — reused for every signal
orchestrator_graph = build_graph()
