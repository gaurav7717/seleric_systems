"""InsightCard schema."""

from datetime import datetime
from typing import Literal

from pydantic import BaseModel, Field


class InsightCard(BaseModel):
    id: str
    signal_id: str
    severity: Literal["critical", "warning", "info"]
    title: str = Field(max_length=80)
    what: str
    why: str
    evidence: list[str]
    confidence: float = Field(ge=0.0, le=1.0)
    agent: str = "insight_agent"
    created_at: datetime
