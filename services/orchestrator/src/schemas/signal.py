"""SignalSchema — internal signal model."""

from typing import Any, Literal, Optional

from pydantic import BaseModel, Field


class SignalSchema(BaseModel):
    signal_id: str
    entity_type: Literal["campaign", "adset", "product", "store"]
    entity_id: str
    signal_type: str
    context_snapshot: dict[str, Any] = Field(default_factory=dict)
    trace_id: Optional[str] = None
