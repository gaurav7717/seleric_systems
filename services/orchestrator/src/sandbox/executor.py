"""Restricted Python executor for data analysis in the chat sandbox."""

from __future__ import annotations

import io
import json
import math
import re
import statistics
import time
from collections import defaultdict
from concurrent.futures import ThreadPoolExecutor, TimeoutError as FuturesTimeout
from datetime import date, datetime, timedelta
from typing import Any

from RestrictedPython import compile_restricted, safe_globals, safe_builtins
from RestrictedPython.Guards import (
    guarded_unpack_sequence,
    safer_getattr,
)

# RestrictedPython 8.x removed guarded_getattr/getitem/getiter/protected_inplacevar;
# provide compatible shims so the sandbox namespace is fully wired.
guarded_getattr = safer_getattr

def guarded_getitem(ob, index):
    return ob[index]

def guarded_getiter(ob):
    return iter(ob)

def protected_inplacevar(op, x, y):
    if op == "+=": return x + y
    if op == "-=": return x - y
    if op == "*=": return x * y
    if op == "/=": return x / y
    if op == "//=": return x // y
    if op == "%=": return x % y
    if op == "**=": return x ** y
    raise ValueError(f"Unsupported inplace op: {op}")

import numpy as _np
import pandas as _pd

try:
    import scipy.stats as _scipy_stats
    _HAS_SCIPY = True
except ImportError:
    _scipy_stats = None  # type: ignore[assignment]
    _HAS_SCIPY = False

_MAX_ROWS_IN = 10_000
_MAX_ROWS_OUT = 2_000

# ---------------------------------------------------------------------------
# Pre-built analytics helpers injected into every sandbox execution
# ---------------------------------------------------------------------------

def _moving_avg(df: _pd.DataFrame, col: str, window: int = 7, *, group_by: str | None = None) -> _pd.Series:
    """Rolling mean of `col` over `window` rows. Pass group_by for per-group windows."""
    if group_by:
        return df.groupby(group_by)[col].transform(lambda s: s.rolling(window, min_periods=1).mean())
    return df[col].rolling(window, min_periods=1).mean()


def _pct_change(series: _pd.Series) -> _pd.Series:
    """Period-over-period % change (returns Series, first value is NaN)."""
    return series.pct_change() * 100


def _yoy(current: float, prior: float) -> float | None:
    """Year-over-year % growth. Returns None when prior is zero."""
    if not prior:
        return None
    return round((current - prior) / prior * 100, 2)


def _top_n(
    df: _pd.DataFrame,
    value_col: str,
    n: int = 10,
    *,
    by: str | None = None,
    ascending: bool = False,
) -> _pd.DataFrame:
    """Return top-N rows by value_col, optionally after a groupby sum on `by`."""
    if by:
        df = df.groupby(by)[value_col].sum().reset_index()
    return df.nlargest(n, value_col) if not ascending else df.nsmallest(n, value_col)


def _compare_periods(
    df: _pd.DataFrame,
    date_col: str,
    metrics: list[str],
    period_a: tuple[str, str],
    period_b: tuple[str, str],
) -> _pd.DataFrame:
    """
    Compare two date periods side by side with absolute and % change.

    period_a / period_b: (start_date_str, end_date_str) e.g. ("2025-04-01", "2025-04-30")
    """
    df = df.copy()
    df[date_col] = _pd.to_datetime(df[date_col])
    pa_start, pa_end = _pd.Timestamp(period_a[0]), _pd.Timestamp(period_a[1])
    pb_start, pb_end = _pd.Timestamp(period_b[0]), _pd.Timestamp(period_b[1])

    mask_a = (df[date_col] >= pa_start) & (df[date_col] <= pa_end)
    mask_b = (df[date_col] >= pb_start) & (df[date_col] <= pb_end)

    rows = []
    for m in metrics:
        val_a = df.loc[mask_a, m].sum()
        val_b = df.loc[mask_b, m].sum()
        change = round((val_a - val_b) / val_b * 100, 2) if val_b else None
        rows.append({"metric": m, "period_a": round(val_a, 4), "period_b": round(val_b, 4), "change_pct": change})
    return _pd.DataFrame(rows)


def _cohort_retention(
    df: _pd.DataFrame,
    *,
    user_col: str,
    cohort_col: str,
    period_col: str,
) -> _pd.DataFrame:
    """
    Build a cohort retention matrix.

    Each cohort_col value is a cohort label (e.g. '2025-01').
    period_col is the observation period (e.g. '2025-02').
    Returns a pivot table: cohorts × periods (values = % of cohort still active).
    """
    df = df.copy()
    cohort_sizes = df.groupby(cohort_col)[user_col].nunique()
    matrix = df.groupby([cohort_col, period_col])[user_col].nunique().reset_index()
    matrix = matrix.pivot(index=cohort_col, columns=period_col, values=user_col)
    for col in matrix.columns:
        matrix[col] = (matrix[col] / cohort_sizes * 100).round(1)
    return matrix.reset_index()


def _funnel(
    df: _pd.DataFrame,
    step_col: str,
    *,
    count_col: str | None = None,
    ordered: bool = True,
) -> _pd.DataFrame:
    """
    Compute funnel steps with conversion rates.

    If count_col is given, sums it per step; otherwise counts rows per step.
    Returns DataFrame: step | count | conversion_rate_pct
    """
    if count_col:
        grp = df.groupby(step_col)[count_col].sum().reset_index(name="count")
    else:
        grp = df.groupby(step_col).size().reset_index(name="count")

    if ordered:
        grp = grp.sort_values("count", ascending=False)
    top = grp["count"].iloc[0] if len(grp) else 1
    grp["conversion_rate_pct"] = (grp["count"] / top * 100).round(2)
    return grp


def _describe(df: _pd.DataFrame, *cols: str) -> _pd.DataFrame:
    """Statistical summary (mean, median, std, min, max, p25, p75) for given (or all numeric) columns."""
    target = df[list(cols)] if cols else df.select_dtypes("number")
    summary = target.agg(["mean", "median", "std", "min", "max"]).T
    summary["p25"] = target.quantile(0.25)
    summary["p75"] = target.quantile(0.75)
    return summary.round(4).reset_index().rename(columns={"index": "column"})


def _anomalies(series: _pd.Series, *, z: float = 2.5) -> _pd.Series:
    """Boolean mask — True where |z-score| > threshold. Apply to DataFrame rows."""
    mean, std = series.mean(), series.std()
    if std == 0:
        return _pd.Series([False] * len(series), index=series.index)
    return ((series - mean) / std).abs() > z


def _corr(df: _pd.DataFrame, *cols: str) -> _pd.DataFrame:
    """Pearson correlation matrix for selected (or all numeric) columns."""
    target = df[list(cols)] if cols else df.select_dtypes("number")
    return target.corr().round(4).reset_index().rename(columns={"index": "metric"})


def _pivot(
    df: _pd.DataFrame,
    index: str | list[str],
    columns: str,
    values: str,
    *,
    aggfunc: str = "sum",
    fill_value: float = 0,
) -> _pd.DataFrame:
    """Shortcut for pd.pivot_table. aggfunc: 'sum', 'mean', 'count', 'max', 'min'."""
    fn = {"sum": _np.sum, "mean": _np.mean, "count": len, "max": _np.max, "min": _np.min}.get(aggfunc, _np.sum)
    return _pd.pivot_table(df, index=index, columns=columns, values=values, aggfunc=fn, fill_value=fill_value).reset_index()


def _growth_rates(df: _pd.DataFrame, value_col: str, *, date_col: str | None = None) -> _pd.DataFrame:
    """Add <value_col>_growth_pct column (period-over-period % change). Returns a copy."""
    out = df.copy()
    if date_col:
        out = out.sort_values(date_col)
    out[f"{value_col}_growth_pct"] = out[value_col].pct_change().mul(100).round(2)
    return out


# Optional scipy helpers — only available when scipy is installed
def _ttest(a: list | _pd.Series, b: list | _pd.Series, *, equal_var: bool = True) -> dict:
    """Welch / Student t-test. Returns {statistic, pvalue, significant_at_95}."""
    if not _HAS_SCIPY:
        return {"error": "scipy not installed"}
    stat, pval = _scipy_stats.ttest_ind(a, b, equal_var=equal_var)
    return {"statistic": round(float(stat), 4), "pvalue": round(float(pval), 4), "significant_at_95": pval < 0.05}


def _pearsonr(x: list | _pd.Series, y: list | _pd.Series) -> dict:
    """Pearson correlation coefficient and p-value."""
    if not _HAS_SCIPY:
        return {"error": "scipy not installed"}
    r, p = _scipy_stats.pearsonr(x, y)
    return {"r": round(float(r), 4), "pvalue": round(float(p), 4)}


# ---------------------------------------------------------------------------
# Sandbox globals builder
# ---------------------------------------------------------------------------

def _make_globals(
    df: _pd.DataFrame,
    data: list[dict],
    named_dfs: dict[str, _pd.DataFrame],
) -> dict:
    """Build a safe execution namespace."""
    import builtins as _builtins_mod

    restricted_builtins = dict(safe_builtins)
    for name in (
        "len", "range", "enumerate", "zip", "map", "filter", "sorted",
        "reversed", "min", "max", "sum", "abs", "round", "int", "float",
        "str", "bool", "list", "dict", "set", "tuple", "type", "isinstance",
        "print", "repr", "format", "all", "any", "iter", "next",
    ):
        restricted_builtins[name] = getattr(_builtins_mod, name)

    ns: dict[str, Any] = {
        **safe_globals,
        "__builtins__": restricted_builtins,
        "_getattr_": guarded_getattr,
        "_getitem_": guarded_getitem,
        "_getiter_": guarded_getiter,
        "_getiter_": guarded_getiter,
        "_inplacevar_": protected_inplacevar,
        "_write_": lambda x: x,
        "_unpack_sequence_": guarded_unpack_sequence,
        # Primary data
        "df": df,
        "data": data,
        # Named datasets
        **named_dfs,
        # Libraries
        "pd": _pd,
        "np": _np,
        "math": math,
        "re": re,
        "json": json,
        "statistics": statistics,
        "datetime": datetime,
        "date": date,
        "timedelta": timedelta,
        "defaultdict": defaultdict,
        # Optional scipy stats
        "stats": _scipy_stats,
        # Analytics helpers
        "moving_avg": _moving_avg,
        "pct_change": _pct_change,
        "yoy": _yoy,
        "top_n": _top_n,
        "compare_periods": _compare_periods,
        "cohort_retention": _cohort_retention,
        "funnel": _funnel,
        "describe": _describe,
        "anomalies": _anomalies,
        "corr": _corr,
        "pivot": _pivot,
        "growth_rates": _growth_rates,
        "ttest": _ttest,
        "pearsonr": _pearsonr,
        # Outputs (code sets these)
        "result": None,
        "results": None,
        "chart_hint": None,
    }
    return ns


# ---------------------------------------------------------------------------
# Core runner (called in thread with timeout)
# ---------------------------------------------------------------------------

def _run_in_thread(
    code: str,
    df: _pd.DataFrame,
    data: list[dict],
    named_dfs: dict[str, _pd.DataFrame],
) -> dict:
    try:
        compiled = compile_restricted(code, "<sandbox>", "exec")
    except SyntaxError as exc:
        return {"result": None, "results": None, "chart_hint": None, "stdout": "", "error": f"SyntaxError: {exc}"}

    globs = _make_globals(df, data, named_dfs)
    buf = io.StringIO()

    import sys as _sys
    old_stdout = _sys.stdout
    _sys.stdout = buf
    try:
        exec(compiled, globs)  # noqa: S102
    except Exception as exc:
        return {
            "result": None,
            "results": None,
            "chart_hint": None,
            "stdout": buf.getvalue(),
            "error": f"{type(exc).__name__}: {exc}",
        }
    finally:
        _sys.stdout = old_stdout

    return {
        "result": globs.get("result"),
        "results": globs.get("results"),
        "chart_hint": globs.get("chart_hint"),
        "stdout": buf.getvalue(),
        "error": None,
    }


# ---------------------------------------------------------------------------
# Serialization helpers
# ---------------------------------------------------------------------------

def _to_rows(value: Any, max_rows: int = _MAX_ROWS_OUT) -> list[dict] | None:
    """Convert a value to a list of dicts if it is tabular, else None."""
    if isinstance(value, _pd.DataFrame):
        return value.head(max_rows).to_dict(orient="records")
    if isinstance(value, _pd.Series):
        return value.head(max_rows).reset_index().to_dict(orient="records")
    if isinstance(value, list) and value and isinstance(value[0], dict):
        return value[:max_rows]
    return None


def _to_scalar(value: Any) -> Any:
    """Convert value to a JSON-safe scalar / dict."""
    try:
        json.dumps(value)
        return value
    except (TypeError, ValueError):
        return str(value)


def _serialize_output(raw_result: Any, raw_results: Any) -> dict:
    """
    Return {"rows", "scalar", "secondary"} from whatever the code produced.

    Priority: `results` dict (multi-output) > `result` (single output).
    """
    secondary: dict[str, Any] = {}

    # Multi-output via results dict
    if isinstance(raw_results, dict) and raw_results:
        primary_key = next(iter(raw_results))
        primary = raw_results[primary_key]
        rows = _to_rows(primary)
        scalar = None if rows is not None else _to_scalar(primary)

        for k, v in raw_results.items():
            if k == primary_key:
                continue
            sub_rows = _to_rows(v)
            if sub_rows is not None:
                secondary[k] = sub_rows
            else:
                secondary[k] = _to_scalar(v)

        return {"rows": rows, "scalar": scalar, "secondary": secondary}

    # Single output via result
    rows = _to_rows(raw_result)
    if rows is not None:
        return {"rows": rows, "scalar": None, "secondary": {}}
    scalar = _to_scalar(raw_result) if raw_result is not None else None
    return {"rows": None, "scalar": scalar, "secondary": {}}


# ---------------------------------------------------------------------------
# Public entry point
# ---------------------------------------------------------------------------

def run_sandbox(
    code: str,
    data: list[dict],
    datasets: dict[str, list[dict]] | None = None,
    timeout_seconds: int = 10,
) -> dict:
    """
    Execute `code` in a restricted Python environment.

    Injected variables:
      df           — pandas DataFrame built from `data`
      data         — raw list of dicts
      <name>_df    — one DataFrame per entry in `datasets`
      pd, np, stats, math, re, json, statistics, datetime, date, timedelta
      moving_avg, pct_change, yoy, top_n, compare_periods, cohort_retention,
      funnel, describe, anomalies, corr, pivot, growth_rates, ttest, pearsonr

    Code must assign output to `result` (single) or `results` (dict of outputs).
    Code may set `chart_hint` to a ChartKind string to guide the renderer.

    Returns:
      rows: list[dict] | None
      scalar: Any | None
      secondary: dict[str, list[dict] | Any]
      chart_hint: str | None
      stdout: str
      error: str | None
      execution_ms: int
    """
    if len(data) > _MAX_ROWS_IN:
        return {
            "rows": None, "scalar": None, "secondary": {},
            "chart_hint": None, "stdout": "",
            "error": f"Input exceeds {_MAX_ROWS_IN} rows. Fetch a smaller dataset.",
            "execution_ms": 0,
        }

    datasets = datasets or {}
    df = _pd.DataFrame(data) if data else _pd.DataFrame()
    named_dfs = {f"{k}_df": _pd.DataFrame(v) for k, v in datasets.items()}

    start = time.monotonic()
    with ThreadPoolExecutor(max_workers=1) as pool:
        future = pool.submit(_run_in_thread, code, df, data, named_dfs)
        try:
            outcome = future.result(timeout=timeout_seconds)
        except FuturesTimeout:
            return {
                "rows": None, "scalar": None, "secondary": {},
                "chart_hint": None, "stdout": "",
                "error": f"Execution timed out after {timeout_seconds}s.",
                "execution_ms": int((time.monotonic() - start) * 1000),
            }

    execution_ms = int((time.monotonic() - start) * 1000)

    if outcome["error"]:
        return {
            "rows": None, "scalar": None, "secondary": {},
            "chart_hint": outcome["chart_hint"],
            "stdout": outcome["stdout"],
            "error": outcome["error"],
            "execution_ms": execution_ms,
        }

    serialized = _serialize_output(outcome["result"], outcome["results"])
    return {
        **serialized,
        "chart_hint": outcome["chart_hint"],
        "stdout": outcome["stdout"],
        "error": None,
        "execution_ms": execution_ms,
    }
