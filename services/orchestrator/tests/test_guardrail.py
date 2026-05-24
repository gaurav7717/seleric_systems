import pytest

from src.tools.query_guard import validate_query


def test_query_guard_rejects_non_select():
    with pytest.raises(ValueError):
        validate_query("DELETE FROM events")
