"""Pure forecast-evaluation functions over the canonical actuals/forecasts frames.

Sign convention: error_mw = forecast_mw - actual_mw. Positive error means wind was
over-forecast, i.e. the buyer would be short and must procure more.
"""

import math
from collections.abc import Iterable
from dataclasses import dataclass
from datetime import date, time, timedelta

import numpy as np
import pandas as pd

from app.config import MAX_HORIZON_HOURS

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
        return {
            "n": 0,
            "mae_mw": None,
            "rmse_mw": None,
            "bias_mw": None,
            "wape_pct": None,
            "p50_abs_mw": None,
            "p90_abs_mw": None,
        }
    err = df["error_mw"]
    abs_err = err.abs()
    total_actual = df["actual_mw"].abs().sum()
    return {
        "n": int(n),
        "mae_mw": _r(abs_err.mean()),
        "rmse_mw": _r(math.sqrt((err**2).mean())),
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


@dataclass(frozen=True)
class ErrorBand:
    low_error_mw: float | None
    high_error_mw: float | None
    samples: int


def error_band(
    forecasts: pd.DataFrame,
    actuals: pd.DataFrame,
    cutoff: pd.Timestamp,
    min_horizon_hours: float,
    lookback_days: int = 14,
    min_samples: int = 48,
    quantiles: tuple[float, float] = (0.1, 0.9),
) -> ErrorBand:
    """Empirical spread of recent signed errors at a similar horizon, using only actuals known at `cutoff`."""
    joined = join_actuals(forecasts_at_horizon(forecasts, min_horizon_hours), actuals)
    joined = joined.dropna(subset=["actual_mw"])
    known = joined[
        (joined["start_time"] + ACTUAL_PUBLICATION_LAG <= cutoff)
        & (joined["start_time"] >= cutoff - pd.Timedelta(days=lookback_days))
    ]
    n = len(known)
    if n < min_samples:
        return ErrorBand(None, None, n)
    lo, hi = known["error_mw"].quantile(list(quantiles))
    return ErrorBand(float(lo), float(hi), n)


def _gate_closure(delivery_date: date, gate_time: time) -> pd.Timestamp:
    day_start = pd.Timestamp(delivery_date.isoformat(), tz="UTC")
    return day_start - pd.Timedelta(days=1) + pd.Timedelta(hours=gate_time.hour, minutes=gate_time.minute)


def decision_view(forecasts: pd.DataFrame, actuals: pd.DataFrame, delivery_date: date, gate_time: time) -> dict:
    day_start = pd.Timestamp(delivery_date.isoformat(), tz="UTC")
    day_end = day_start + pd.Timedelta(days=1)
    cutoff = _gate_closure(delivery_date, gate_time)

    eligible = forecasts[forecasts["publish_time"] <= cutoff]
    latest = within(eligible, day_start, day_end)
    latest = latest.sort_values("publish_time").drop_duplicates("start_time", keep="last").sort_values("start_time")
    joined = join_actuals(latest, actuals)

    points = []
    band_samples = []
    for row in joined.itertuples(index=False):
        # Error grows with lead time, so each hour's range comes from past errors at its own lead.
        band = error_band(forecasts, actuals, cutoff, (row.start_time - cutoff) / HOUR)
        band_samples.append(band.samples)
        low = high = None
        if band.low_error_mw is not None:
            # actual = forecast - error, so the high error quantile gives the low generation bound.
            low = max(0.0, row.forecast_mw - band.high_error_mw)
            high = row.forecast_mw - band.low_error_mw
        points.append(
            {
                "start_time": row.start_time.to_pydatetime(),
                "forecast_mw": _r(row.forecast_mw),
                "actual_mw": _r(row.actual_mw),
                "low_mw": _r(low),
                "high_mw": _r(high),
            }
        )

    complete_actuals = len(joined) > 0 and bool(joined["actual_mw"].notna().all())
    return {
        "delivery_date": delivery_date,
        "gate_closure": cutoff.to_pydatetime(),
        "forecast_published_at": latest["publish_time"].max().to_pydatetime() if len(latest) else None,
        "band_samples": min(band_samples, default=0),
        "points": points,
        # WINDFOR is hourly, so summing MW over the points gives MWh.
        "forecast_energy_mwh": _r(joined["forecast_mw"].sum()),
        "actual_energy_mwh": _r(joined["actual_mw"].sum()) if complete_actuals else None,
        "metrics": error_metrics(joined),
    }


def band_calibration(forecasts: pd.DataFrame, actuals: pd.DataFrame, first: date, last: date, gate_time: time) -> dict:
    """How often outturn landed inside / below / above the decision-view P10-P90 range (nominal 80/10/10)."""
    inside = below = above = 0
    day = first
    while day <= last:
        for p in decision_view(forecasts, actuals, day, gate_time)["points"]:
            if p["low_mw"] is None or p["actual_mw"] is None:
                continue
            if p["actual_mw"] < p["low_mw"]:
                below += 1
            elif p["actual_mw"] > p["high_mw"]:
                above += 1
            else:
                inside += 1
        day += timedelta(days=1)
    n = inside + below + above
    pct = (lambda k: _r(k / n * 100)) if n else (lambda k: None)
    return {"n": n, "inside_pct": pct(inside), "below_p10_pct": pct(below), "above_p90_pct": pct(above)}


def accuracy_view(
    forecasts: pd.DataFrame, actuals: pd.DataFrame, horizon_hours: int, start: pd.Timestamp, end: pd.Timestamp
) -> dict:
    rows = within(join_actuals(forecasts_at_horizon(forecasts, horizon_hours), actuals), start, end)
    points = [
        {
            "start_time": r.start_time.to_pydatetime(),
            "publish_time": r.publish_time.to_pydatetime(),
            "forecast_mw": _r(r.forecast_mw),
            "actual_mw": _r(r.actual_mw),
            "error_mw": _r(r.error_mw),
        }
        for r in rows.itertuples(index=False)
    ]
    return {
        "horizon_hours": horizon_hours,
        "points": points,
        "metrics": error_metrics(rows),
        "histogram": error_histogram(rows),
    }


def horizon_profile(
    forecasts: pd.DataFrame,
    actuals: pd.DataFrame,
    start: pd.Timestamp,
    end: pd.Timestamp,
    horizons: Iterable[int] = range(0, MAX_HORIZON_HOURS + 1, 3),
) -> list[dict]:
    out = []
    for h in horizons:
        rows = within(join_actuals(forecasts_at_horizon(forecasts, h), actuals), start, end)
        rows = rows.dropna(subset=["actual_mw"])
        p10 = p90 = None
        if len(rows):
            p10, p90 = rows["error_mw"].quantile([0.1, 0.9])
        out.append(
            {
                "horizon_hours": h,
                "metrics": error_metrics(rows),
                "p10_error_mw": _r(p10),
                "p90_error_mw": _r(p90),
            }
        )
    return out
