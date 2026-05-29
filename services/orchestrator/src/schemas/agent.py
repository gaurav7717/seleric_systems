"""AgentContext and AgentResult schemas."""

from typing import Any, Optional

from pydantic import BaseModel, Field


class AgentContext(BaseModel):
    signal_id: str
    entity_type: str
    entity_id: str
    signal_type: str
    assembled_prompt: str
    context_snapshot: dict[str, Any] = Field(default_factory=dict)
    current_metrics: dict[str, Any] = Field(default_factory=dict)
    session_memory: Optional[dict[str, Any]] = None
    similar_insights: Optional[list[dict[str, Any]]] = None
    available_tools: list[str] = Field(default_factory=list)


class AgentResult(BaseModel):
    agent: str
    signal_id: str
    insight: Optional[dict[str, Any]] = None
    action_proposals: list[dict[str, Any]] = Field(default_factory=list)
    raw_response: str = ""
    tool_calls_made: list[dict[str, Any]] = Field(default_factory=list)
    latency_ms: int = 0
    tokens_used: int = 0
