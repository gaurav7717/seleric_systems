"""Provider-agnostic LLM + embedding client backed by LiteLLM.

Model selection (checked in order — first non-empty value wins):
  1. ORCHESTRATOR_MODEL   e.g. kimi-k2.6:cloud, openai/gpt-4o
  2. LLM_MODEL            any LiteLLM model string

At least one must be set; the service raises at startup if both are absent.

Custom OpenAI-compatible endpoints (Ollama, vLLM, etc.):
  Set OLLAMA_CLOUD_URL (api_base) and OLLAMA_CLOUD_API_KEY.
  Any model string without a recognised provider prefix is automatically
  wrapped as "openai/<model>" so LiteLLM routes it to the custom base.

Tool definitions must use OpenAI function-calling format:
  {"type": "function", "function": {"name": ..., "description": ..., "parameters": {...}}}
"""

import os
from typing import Optional

import litellm

litellm.drop_params = True  # silently drop unsupported params per provider

_KNOWN_PREFIXES = ("openai/", "claude", "gpt", "gemini/", "azure/", "anthropic/", "ollama/")


def _resolve_model() -> str:
    model = os.getenv("ORCHESTRATOR_MODEL") or os.getenv("LLM_MODEL")
    if not model:
        raise RuntimeError(
            "No LLM model configured. Set ORCHESTRATOR_MODEL or LLM_MODEL in your environment."
        )
    return model


def _model_kwargs() -> dict:
    """Build model + optional api_base / api_key kwargs."""
    model = _resolve_model()
    api_base: Optional[str] = os.getenv("OLLAMA_CLOUD_URL") or None
    api_key: Optional[str] = os.getenv("OLLAMA_CLOUD_API_KEY") or None

    # When a custom base is provided, LiteLLM needs "openai/" prefix for OpenAI-compat endpoints
    if api_base and not any(model.startswith(p) for p in _KNOWN_PREFIXES):
        model = f"openai/{model}"

    kwargs: dict = {"model": model}
    if api_base:
        kwargs["api_base"] = api_base
    if api_key:
        kwargs["api_key"] = api_key
    return kwargs


async def chat_completion(
    *,
    system: str,
    messages: list[dict],
    tools: list[dict] | None = None,
    max_tokens: int = 4096,
):
    """Call any LLM via LiteLLM. Returns an OpenAI-format ModelResponse."""
    kwargs = _model_kwargs()
    full_messages = [{"role": "system", "content": system}, *messages]
    kwargs["messages"] = full_messages
    kwargs["max_tokens"] = max_tokens

    temperature = os.getenv("ORCHESTRATOR_TEMPERATURE")
    if temperature is not None:
        kwargs["temperature"] = float(temperature)

    if tools:
        kwargs["tools"] = tools
    return await litellm.acompletion(**kwargs)


async def embed(text: str) -> list[float] | None:
    """Generate an embedding vector. Returns None if embedding is unavailable."""
    model = os.getenv("EMBEDDING_MODEL", "text-embedding-3-small")
    api_base: Optional[str] = os.getenv("OLLAMA_CLOUD_URL") or None
    api_key: Optional[str] = os.getenv("OLLAMA_CLOUD_API_KEY") or None

    if api_base and not any(model.startswith(p) for p in _KNOWN_PREFIXES):
        model = f"openai/{model}"

    kwargs: dict = {"model": model, "input": [text]}
    if api_base:
        kwargs["api_base"] = api_base
    if api_key:
        kwargs["api_key"] = api_key

    try:
        response = await litellm.aembedding(**kwargs)
        return response.data[0]["embedding"]
    except Exception:
        return None


def extract_text(response) -> str:
    return response.choices[0].message.content or ""


def extract_tokens(response) -> int:
    return getattr(response.usage, "completion_tokens", 0)
