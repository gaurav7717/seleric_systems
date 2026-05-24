"""Pydantic request/response models for orchestrator API."""

from typing import Any, Literal, Optional

from pydantic import BaseModel, Field

from src.schemas.signal import SignalSchema

__all__ = ["SignalSchema", "SignalResponseSchema", "StatusResponseSchema"]


class SignalResponseSchema(BaseModel):
    status: Literal["accepted", "duplicate", "error"]
    trace_id: str
    message: Optional[str] = None


class StatusResponseSchema(BaseModel):
    trace_id: str
    status: str
    errors: list[str] = Field(default_factory=list)
    insight_card: Optional[dict[str, Any]] = None
    auto_actions: int = 0
    queued_actions: int = 0
