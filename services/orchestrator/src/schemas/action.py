"""ActionProposal and GuardrailResult schemas."""

from typing import Any, Literal, Optional

from pydantic import BaseModel, Field


class ActionProposal(BaseModel):
    proposal_id: str
    signal_id: str
    entity_type: str
    entity_id: str
    agent: str
    action_type: str
    action_payload: dict[str, Any]
    rationale: str
    expected_outcome: str
    confidence: float = Field(ge=0.0, le=1.0)
    risk_level: Literal["low", "medium", "high"]
    requires_approval: bool = False


class GuardrailResult(BaseModel):
    proposal_id: str
    classification: Literal["AUTO", "QUEUE", "BLOCK"]
    rule_matched: Optional[str] = None
    reason: Optional[str] = None
