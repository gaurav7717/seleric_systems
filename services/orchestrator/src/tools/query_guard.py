"""SQL validation layer for ClickHouse queries."""

import re

FORBIDDEN = re.compile(
    r"\b(DROP|DELETE|INSERT|UPDATE|ALTER|TRUNCATE|GRANT|REVOKE)\b",
    re.IGNORECASE,
)


def validate_query(sql: str) -> str:
    stripped = sql.strip()
    if not stripped.upper().startswith("SELECT"):
        raise ValueError("Only SELECT queries are allowed")
    if FORBIDDEN.search(stripped):
        raise ValueError("Query contains forbidden keywords")
    if ";" in stripped.rstrip(";"):
        raise ValueError("Multiple statements are not allowed")
    return stripped
