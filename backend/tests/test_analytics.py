import pandas as pd

from app.analytics import (
    error_histogram,
    error_metrics,
    forecasts_at_horizon,
    join_actuals,
    within,
)

T = pd.Timestamp


def _row(df, start_time):
    return df[df["start_time"] == T(start_time)].iloc[0]


def test_horizon_zero_picks_most_recent_run(dataset):
    rows = forecasts_at_horizon(dataset.forecasts, 0)
    r = _row(rows, "2026-01-02T03:00Z")
    assert r["publish_time"] == T("2026-01-02T00:00Z")
    assert r["horizon_hours"] == 3
    assert r["forecast_mw"] == 1030


def test_horizon_twelve_uses_run_published_at_least_12h_before(dataset):
    rows = forecasts_at_horizon(dataset.forecasts, 12)
    r = _row(rows, "2026-01-02T03:00Z")
    assert r["publish_time"] == T("2026-01-01T12:00Z")
    assert r["forecast_mw"] == 1150


def test_join_actuals_computes_signed_error(dataset):
    joined = join_actuals(forecasts_at_horizon(dataset.forecasts, 0), dataset.actuals)
    r = _row(joined, "2026-01-02T03:00Z")
    assert r["actual_mw"] == 1000
    assert r["error_mw"] == 30


def test_within_is_half_open(dataset):
    joined = join_actuals(forecasts_at_horizon(dataset.forecasts, 0), dataset.actuals)
    day = within(joined, T("2026-01-02T00:00Z"), T("2026-01-03T00:00Z"))
    assert len(day) == 24
    assert day["start_time"].max() == T("2026-01-02T23:00Z")


def test_error_metrics_ignores_missing_actuals():
    joined = pd.DataFrame({
        "forecast_mw": [110.0, 90.0, 100.0],
        "actual_mw": [100.0, 100.0, None],
    })
    joined["error_mw"] = joined["forecast_mw"] - joined["actual_mw"]
    m = error_metrics(joined)
    assert m == {
        "n": 2,
        "mae_mw": 10.0,
        "rmse_mw": 10.0,
        "bias_mw": 0.0,
        "wape_pct": 10.0,
        "p50_abs_mw": 10.0,
        "p90_abs_mw": 10.0,
    }


def test_error_metrics_empty():
    empty = pd.DataFrame({"forecast_mw": [], "actual_mw": [], "error_mw": []})
    m = error_metrics(empty)
    assert m["n"] == 0
    assert m["mae_mw"] is None and m["wape_pct"] is None


def test_error_histogram_bins():
    joined = pd.DataFrame({"error_mw": [-100.0, 0.0, 100.0, 260.0, None]})
    bins = error_histogram(joined, bin_width_mw=250)
    assert bins == [
        {"bin_start_mw": -250.0, "bin_end_mw": 0.0, "count": 1},
        {"bin_start_mw": 0.0, "bin_end_mw": 250.0, "count": 2},
        {"bin_start_mw": 250.0, "bin_end_mw": 500.0, "count": 1},
    ]


def test_error_histogram_empty():
    assert error_histogram(pd.DataFrame({"error_mw": []})) == []
