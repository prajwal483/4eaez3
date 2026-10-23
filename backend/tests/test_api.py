import pytest
from fastapi.testclient import TestClient

from app.main import create_app


@pytest.fixture
def client(dataset):
    return TestClient(create_app(lambda: dataset, static_dir=None))


def test_health(client):
    assert client.get("/api/health").json() == {"status": "ok"}


def test_meta(client):
    body = client.get("/api/meta").json()
    assert body["first_delivery_date"] == "2026-01-02"
    assert body["last_delivery_date"] == "2026-02-01"
    assert body["default_gate_time_utc"] == "09:20"
    assert body["max_horizon_hours"] == 48
    assert body["forecast_runs"] == 16
    assert body["data_source"] == "snapshot"


def test_decision(client):
    res = client.get("/api/decision", params={"delivery_date": "2026-01-03"})
    assert res.status_code == 200
    body = res.json()
    assert body["gate_closure"].startswith("2026-01-02T09:20:00")
    assert body["forecast_published_at"].startswith("2026-01-02T06:00:00")
    assert len(body["points"]) == 24
    assert body["points"][0]["forecast_mw"] == 1180.0
    assert body["forecast_energy_mwh"] == 31080.0


def test_decision_rejects_date_outside_window(client):
    res = client.get("/api/decision", params={"delivery_date": "2026-03-01"})
    assert res.status_code == 400
    assert "2026-01-02" in res.json()["detail"]


def test_decision_accepts_gate_time(client):
    res = client.get("/api/decision", params={"delivery_date": "2026-01-03", "gate_time": "09:50"})
    assert res.json()["gate_closure"].startswith("2026-01-02T09:50:00")


def test_decision_rejects_bad_gate_time(client):
    res = client.get("/api/decision", params={"delivery_date": "2026-01-03", "gate_time": "25:00"})
    assert res.status_code == 422


def test_accuracy_one_day(client):
    res = client.get("/api/accuracy", params={"horizon": 0, "start": "2026-01-02", "end": "2026-01-02"})
    assert res.status_code == 200
    body = res.json()
    assert body["metrics"]["n"] == 24
    assert body["metrics"]["mae_mw"] == 25.0
    assert len(body["histogram"]) > 0


def test_accuracy_rejects_bad_horizon(client):
    assert client.get("/api/accuracy", params={"horizon": 99}).status_code == 422


def test_accuracy_rejects_inverted_range(client):
    res = client.get("/api/accuracy", params={"start": "2026-01-10", "end": "2026-01-05"})
    assert res.status_code == 400


def test_by_horizon_default_horizons(client):
    rows = client.get("/api/accuracy/by-horizon").json()
    assert [r["horizon_hours"] for r in rows] == list(range(0, 49, 3))
