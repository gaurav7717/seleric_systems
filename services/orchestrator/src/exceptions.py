"""Custom exception classes for the orchestrator service."""


class OrchestratorError(Exception):
    """Base orchestrator error."""

    def __init__(self, message: str, *, trace_id: str | None = None) -> None:
        super().__init__(message)
        self.trace_id = trace_id


class SignalValidationError(OrchestratorError):
    """Signal payload failed validation."""


class ContextAssemblyError(OrchestratorError):
    """Failed to assemble agent context."""


class AgentExecutionError(OrchestratorError):
    """Agent run failed."""


class GuardrailError(OrchestratorError):
    """Guardrail classification failed."""


class QueryGuardError(OrchestratorError):
    """ClickHouse query rejected by guard layer."""
