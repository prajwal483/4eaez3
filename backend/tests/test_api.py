import pytest
from fastapi.testclient import TestClient

from app.deps import get_dataset
from app.main import create_app


@pytest.fixture
def client(dataset):
    app = create_app(static_dir=None)
    app.dependency_overrides[get_dataset] = lambda: dataset
    return TestClient(app)


def test_health_reports_dataset(client):
    body = client.get("/api/v1/health").json()
    assert body == {"status": "ok", "data_source": "snapshot", "forecast_runs": 16, "actual_periods": 288}


def test_meta(client):
    body = client.get("/api/v1/meta").json()
    assert body["first_delivery_date"] == "2026-01-02"
    assert body["last_delivery_date"] == "2026-02-01"
    assert body["default_gate_time_utc"] == "09:20"
    assert body["max_horizon_hours"] == 48
    assert body["forecast_runs"] == 16
    assert body["data_source"] == "snapshot"


def test_decision(client):
    res = client.get("/api/v1/decision", params={"delivery_date": "2026-01-03"})
    assert res.status_code == 200
    body = res.json()
    assert body["gate_closure"].startswith("2026-01-02T09:20:00")
    assert body["forecast_published_at"].startswith("2026-01-02T06:00:00")
    assert len(body["points"]) == 24
    assert body["points"][0]["forecast_mw"] == 1180.0
    assert body["forecast_energy_mwh"] == 31080.0


def test_decision_accepts_gate_time(client):
    res = client.get("/api/v1/decision", params={"delivery_date": "2026-01-03", "gate_time": "09:50"})
    assert res.json()["gate_closure"].startswith("2026-01-02T09:50:00")


def test_decision_outside_window_uses_error_envelope(client):
    res = client.get("/api/v1/decision", params={"delivery_date": "2026-03-01"})
    assert res.status_code == 400
    error = res.json()["error"]
    assert error["code"] == "out_of_window"
    assert "2026-01-02" in error["message"]


def test_invalid_parameter_lists_the_field(client):
    res = client.get("/api/v1/decision", params={"delivery_date": "2026-01-03", "gate_time": "25:00"})
    assert res.status_code == 422
    error = res.json()["error"]
    assert error["code"] == "invalid_request"
    assert error["details"][0]["field"] == "gate_time"


def test_accuracy_one_day(client):
    res = client.get("/api/v1/accuracy", params={"horizon": 0, "start": "2026-01-02", "end": "2026-01-02"})
    assert res.status_code == 200
    body = res.json()
    assert body["metrics"]["n"] == 24
    assert body["metrics"]["mae_mw"] == 25.0
    assert len(body["histogram"]) > 0


def test_accuracy_rejects_bad_horizon(client):
    res = client.get("/api/v1/accuracy", params={"horizon": 99})
    assert res.status_code == 422
    assert res.json()["error"]["details"][0]["field"] == "horizon"


def test_accuracy_rejects_inverted_range(client):
    res = client.get("/api/v1/accuracy", params={"start": "2026-01-10", "end": "2026-01-05"})
    assert res.status_code == 400
    assert res.json()["error"]["code"] == "invalid_range"


def test_by_horizon_default_horizons(client):
    rows = client.get("/api/v1/accuracy/by-horizon").json()
    assert [r["horizon_hours"] for r in rows] == list(range(0, 49, 3))


def test_unknown_route_uses_error_envelope(client):
    res = client.get("/api/v1/nope")
    assert res.status_code == 404
    assert res.json()["error"]["code"] == "not_found"


def test_successful_reads_are_cacheable(client):
    assert client.get("/api/v1/meta").headers["Cache-Control"] == "public, max-age=300, s-maxage=86400"
    assert "Cache-Control" not in client.get("/api/v1/health").headers
    assert "Cache-Control" not in client.get("/api/v1/decision", params={"delivery_date": "2026-03-01"}).headers


def test_legacy_unversioned_paths_still_work_but_are_hidden(client):
    assert client.get("/api/meta").status_code == 200
    paths = client.get("/openapi.json").json()["paths"]
    assert "/api/v1/decision" in paths
    assert "/api/decision" not in paths
