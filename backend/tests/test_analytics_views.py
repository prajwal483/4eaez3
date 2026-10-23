from datetime import date, time

import pandas as pd

from app.analytics import accuracy_view, band_calibration, decision_view, error_band, horizon_profile

T = pd.Timestamp


def test_error_band_uses_only_actuals_known_at_cutoff(dataset):
    band = error_band(dataset.forecasts, dataset.actuals, T("2026-01-03T11:00Z"), 13)
    # Targets 2025-12-31 13:00 .. 2026-01-03 10:00 inclusive (10:00 + 30 min lag <= 11:00).
    assert band.samples == 70
    # At horizons 13..18 h the synthetic error is 130..180 MW.
    assert 130 <= band.low_error_mw <= band.high_error_mw <= 180


def test_error_band_none_when_too_little_history(dataset):
    band = error_band(dataset.forecasts, dataset.actuals, T("2026-01-01T00:00Z"), 13)
    assert band.samples == 11
    assert band.low_error_mw is None and band.high_error_mw is None


def test_decision_view_uses_latest_run_before_gate(dataset):
    view = decision_view(dataset.forecasts, dataset.actuals, date(2026, 1, 3), time(11, 0))
    assert view["gate_closure"] == T("2026-01-02T11:00Z")
    assert view["forecast_published_at"] == T("2026-01-02T06:00Z")
    assert len(view["points"]) == 24
    first = view["points"][0]
    assert first["start_time"] == T("2026-01-03T00:00Z")
    assert first["forecast_mw"] == 1180.0
    assert first["actual_mw"] == 1000.0
    assert view["forecast_energy_mwh"] == 31080.0
    assert view["actual_energy_mwh"] == 24000.0
    assert view["metrics"]["mae_mw"] == 295.0
    # Each hour's band uses its own lead time (13..36 h); the 36 h lead has only 23 known pairs (< 48).
    assert view["band_samples"] == 23
    assert first["low_mw"] is None and first["high_mw"] is None


def test_decision_view_band_uses_each_hours_lead_time(dataset):
    view = decision_view(dataset.forecasts, dataset.actuals, date(2026, 1, 4), time(11, 0))
    # Hour k is 13+k h after gate closure; known pairs at lead L number 83-L, so 23:00 (L=36) has 47 < 48.
    assert view["band_samples"] == 47
    for k, p in enumerate(view["points"][:23]):
        lead = 13 + k
        # At lead L the synthetic error is 10*L .. 10*(L+5) MW.
        assert p["forecast_mw"] - 10 * (lead + 5) <= p["low_mw"] <= p["high_mw"] <= p["forecast_mw"] - 10 * lead
    assert view["points"][23]["low_mw"] is None


def test_decision_view_gate_minutes_pick_earlier_run(dataset):
    view = decision_view(dataset.forecasts, dataset.actuals, date(2026, 1, 3), time(5, 59))
    assert view["gate_closure"] == T("2026-01-02T05:59Z")
    assert view["forecast_published_at"] == T("2026-01-02T00:00Z")


def test_decision_view_partial_actuals_gives_none_energy(dataset):
    partial = dataset.actuals[dataset.actuals["start_time"] < T("2026-01-03T12:00Z")]
    view = decision_view(dataset.forecasts, partial, date(2026, 1, 3), time(11, 0))
    assert len(view["points"]) == 24
    assert view["actual_energy_mwh"] is None
    assert view["metrics"]["n"] == 12
    assert view["points"][12]["actual_mw"] is None


def test_accuracy_view_for_one_day(dataset):
    view = accuracy_view(dataset.forecasts, dataset.actuals, 0, T("2026-01-02T00:00Z"), T("2026-01-03T00:00Z"))
    assert view["horizon_hours"] == 0
    assert len(view["points"]) == 24
    assert view["metrics"]["n"] == 24
    assert view["metrics"]["mae_mw"] == 25.0
    assert view["metrics"]["bias_mw"] == 25.0
    assert sum(b["count"] for b in view["histogram"]) == 24


def test_horizon_profile_error_grows_with_horizon(dataset):
    rows = horizon_profile(
        dataset.forecasts, dataset.actuals, T("2026-01-02T00:00Z"), T("2026-01-03T00:00Z"), horizons=[0, 24]
    )
    assert [r["horizon_hours"] for r in rows] == [0, 24]
    assert rows[0]["metrics"]["mae_mw"] == 25.0
    assert rows[1]["metrics"]["mae_mw"] == 265.0
    assert rows[1]["p10_error_mw"] <= rows[1]["p90_error_mw"]


def test_band_calibration_counts_hours_with_a_band(dataset):
    cal = band_calibration(dataset.forecasts, dataset.actuals, date(2026, 1, 3), date(2026, 1, 4), time(11, 0))
    assert cal["n"] == 23
    assert round(cal["inside_pct"] + cal["below_p10_pct"] + cal["above_p90_pct"], 1) == 100.0
