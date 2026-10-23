import httpx
import pandas as pd
import pytest
from fastapi.testclient import TestClient

from app import store
from app.analytics import error_metrics
from app.deps import get_dataset
from app.elexon import fetch_forecasts
from app.main import create_app
from app.store import Dataset


@pytest.fixture
def client(dataset):
    app = create_app(static_dir=None)
    app.dependency_overrides[get_dataset] = lambda: dataset
    return TestClient(app)


def test_day_without_any_forecast_returns_an_empty_view(client):
    # Synthetic runs end 2026-01-03 18:00 and reach 48 h ahead, so nothing covers 6 Jan.
    body = client.get("/api/v1/decision", params={"delivery_date": "2026-01-06"}).json()
    assert body["points"] == []
    assert body["forecast_published_at"] is None
    assert body["forecast_energy_mwh"] is None
    assert body["actual_energy_mwh"] is None
    assert body["metrics"]["n"] == 0


@pytest.mark.parametrize(("gate", "expected"), [("00:00", "2026-01-02T00:00:00"), ("23:59", "2026-01-02T23:59:00")])
def test_gate_closure_accepts_the_ends_of_the_day(client, gate, expected):
    body = client.get("/api/v1/decision", params={"delivery_date": "2026-01-03", "gate_time": gate}).json()
    assert body["gate_closure"].startswith(expected)


@pytest.mark.parametrize("horizon", [0, 48])
def test_accuracy_accepts_horizon_bounds(client, horizon):
    assert client.get("/api/v1/accuracy", params={"horizon": horizon}).status_code == 200


def test_by_horizon_for_a_single_day(client):
    rows = client.get("/api/v1/accuracy/by-horizon", params={"start": "2026-01-02", "end": "2026-01-02"}).json()
    assert rows[0]["metrics"]["n"] == 24


def test_wape_is_undefined_when_outturn_is_zero():
    joined = pd.DataFrame({"forecast_mw": [10.0], "actual_mw": [0.0]})
    joined["error_mw"] = joined["forecast_mw"] - joined["actual_mw"]
    metrics = error_metrics(joined)
    assert metrics["mae_mw"] == 10.0
    assert metrics["wape_pct"] is None


def test_dataset_falls_back_to_live_fetch_without_a_snapshot(tmp_path, monkeypatch, dataset):
    live = Dataset(actuals=dataset.actuals, forecasts=dataset.forecasts, source="live")
    monkeypatch.setattr(store, "SNAPSHOT_DIR", tmp_path)
    monkeypatch.setattr(store, "fetch_live", lambda client: live)
    store.get_dataset.cache_clear()
    try:
        assert store.get_dataset().source == "live"
    finally:
        store.get_dataset.cache_clear()


def test_upstream_errors_are_raised_not_swallowed():
    transport = httpx.MockTransport(lambda request: httpx.Response(503, json={"message": "maintenance"}))
    with httpx.Client(transport=transport) as client, pytest.raises(httpx.HTTPStatusError):
        fetch_forecasts(client, pd.Timestamp("2026-01-01", tz="UTC"), pd.Timestamp("2026-01-02", tz="UTC"))
