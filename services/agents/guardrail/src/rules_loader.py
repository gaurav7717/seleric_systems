"""Load + validate config/rules.yaml."""

import os
from pathlib import Path
from typing import Any

import yaml


def load_rules() -> dict[str, Any]:
    rules_path = Path(os.getenv("GUARDRAIL_RULES_PATH", "config/rules.yaml"))
    if not rules_path.is_absolute():
        # Walk up from CWD to find the config dir (covers local dev, Docker, tests)
        search_bases = [Path.cwd(), Path("/app")]
        cur = Path.cwd()
        for _ in range(5):
            search_bases.append(cur)
            cur = cur.parent
        for base in search_bases:
            candidate = base / rules_path
            if candidate.exists():
                rules_path = candidate
                break

    with rules_path.open(encoding="utf-8") as f:
        return yaml.safe_load(f) or {}
