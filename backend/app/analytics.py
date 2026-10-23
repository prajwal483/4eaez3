"""Pure forecast-evaluation functions over the canonical actuals/forecasts frames.

Sign convention: error_mw = forecast_mw - actual_mw. Positive error means wind was
over-forecast, i.e. the buyer would be short and must procure more.
"""
import math

import numpy as np
import pandas as pd

HOUR = pd.Timedelta(hours=1)
# FUELHH values for a settlement period are published 30 minutes after it starts.
ACTUAL_PUBLICATION_LAG = pd.Timedelta(minutes=30)


def _r(x) -> float | None:
    if x is None or pd.isna(x):
        return None
    return round(float(x), 1)


def forecasts_at_horizon(forecasts: pd.DataFrame, min_horizon_hours: float) -> pd.DataFrame:
    """For each target time, the latest forecast published at least `min_horizon_hours` before it."""
    f = forecasts.copy()
    f["horizon_hours"] = (f["start_time"] - f["publish_time"]) / HOUR
    f = f[f["horizon_hours"] >= min_horizon_hours]
    f = f.sort_values("publish_time").drop_duplicates("start_time", keep="last")
    return f.sort_values("start_time").reset_index(drop=True)


def join_actuals(forecast_rows: pd.DataFrame, actuals: pd.DataFrame) -> pd.DataFrame:
    out = forecast_rows.merge(actuals, on="start_time", how="left")
    out["error_mw"] = out["forecast_mw"] - out["actual_mw"]
    return out


def within(df: pd.DataFrame, start: pd.Timestamp, end: pd.Timestamp) -> pd.DataFrame:
    return df[(df["start_time"] >= start) & (df["start_time"] < end)]


def error_metrics(joined: pd.DataFrame) -> dict:
    df = joined.dropna(subset=["actual_mw"])
    n = len(df)
    if n == 0:
        return {"n": 0, "mae_mw": None, "rmse_mw": None, "bias_mw": None,
                "wape_pct": None, "p50_abs_mw": None, "p90_abs_mw": None}
    err = df["error_mw"]
    abs_err = err.abs()
    total_actual = df["actual_mw"].abs().sum()
    return {
        "n": int(n),
        "mae_mw": _r(abs_err.mean()),
        "rmse_mw": _r(math.sqrt((err ** 2).mean())),
        "bias_mw": _r(err.mean()),
        "wape_pct": _r(abs_err.sum() / total_actual * 100) if total_actual else None,
        "p50_abs_mw": _r(abs_err.quantile(0.5)),
        "p90_abs_mw": _r(abs_err.quantile(0.9)),
    }


def error_histogram(joined: pd.DataFrame, bin_width_mw: int = 250) -> list[dict]:
    errors = joined["error_mw"].dropna().to_numpy()
    if errors.size == 0:
        return []
    lo = math.floor(errors.min() / bin_width_mw) * bin_width_mw
    hi = (math.floor(errors.max() / bin_width_mw) + 1) * bin_width_mw
    counts, edges = np.histogram(errors, bins=np.arange(lo, hi + bin_width_mw, bin_width_mw))
    return [
        {"bin_start_mw": float(edges[i]), "bin_end_mw": float(edges[i + 1]), "count": int(c)}
        for i, c in enumerate(counts)
    ]
