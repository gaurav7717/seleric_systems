"""Sandbox API route: POST /sandbox/execute"""

from __future__ import annotations

import structlog
from fastapi import APIRouter
from pydantic import BaseModel, Field

from .executor import run_sandbox

logger = structlog.get_logger()
router = APIRouter(prefix="/sandbox", tags=["sandbox"])


class SandboxRequest(BaseModel):
    code: str = Field(..., description="Python code. Must set `result` or `results`.")
    data: list[dict] = Field(default_factory=list, description="Primary dataset → `df` and `data`.")
    datasets: dict[str, list[dict]] = Field(
        default_factory=dict,
        description="Named extra datasets → injected as `{name}_df` variables.",
    )
    timeout_seconds: int = Field(default=10, ge=1, le=30)


class SandboxResponse(BaseModel):
    rows: list[dict] | None = None
    scalar: object | None = None
    secondary: dict = Field(default_factory=dict)
    chart_hint: str | None = None
    stdout: str = ""
    error: str | None = None
    execution_ms: int = 0


@router.post("/execute", response_model=SandboxResponse)
async def execute(body: SandboxRequest) -> SandboxResponse:
    logger.info(
        "sandbox_execute",
        code_chars=len(body.code),
        input_rows=len(body.data),
        named_datasets=list(body.datasets.keys()),
    )
    result = run_sandbox(body.code, body.data, body.datasets, body.timeout_seconds)
    if result["error"]:
        logger.warning("sandbox_error", error=result["error"], execution_ms=result["execution_ms"])
    else:
        row_count = len(result["rows"]) if result["rows"] else 0
        logger.info("sandbox_ok", row_count=row_count, execution_ms=result["execution_ms"])
    return SandboxResponse(**result)
