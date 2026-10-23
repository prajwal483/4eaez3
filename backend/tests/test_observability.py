import json
import logging
import re

import pytest
from fastapi.testclient import TestClient

from app.deps import get_dataset
from app.main import create_app
from app.observability import JsonFormatter


@pytest.fixture
def app(dataset):
    app = create_app(static_dir=None)
    app.dependency_overrides[get_dataset] = lambda: dataset

    @app.get("/api/v1/boom")
    def boom():
        raise RuntimeError("kaboom")

    return app


@pytest.fixture
def client(app):
    return TestClient(app, raise_server_exceptions=False)


def test_every_response_gets_a_request_id(client):
    res = client.get("/api/v1/meta")
    assert re.fullmatch(r"[0-9a-f]{32}", res.headers["X-Request-ID"])


def test_valid_incoming_request_id_is_echoed(client):
    assert client.get("/api/v1/meta", headers={"X-Request-ID": "trace-123"}).headers["X-Request-ID"] == "trace-123"


def test_unsafe_incoming_request_id_is_replaced(client):
    res = client.get("/api/v1/meta", headers={"X-Request-ID": "bad id; drop"})
    assert res.headers["X-Request-ID"] != "bad id; drop"
    assert re.fullmatch(r"[0-9a-f]{32}", res.headers["X-Request-ID"])


def test_error_body_carries_the_request_id(client):
    res = client.get("/api/v1/decision", params={"delivery_date": "2026-03-01"}, headers={"X-Request-ID": "abc"})
    assert res.json()["error"]["request_id"] == "abc"


def test_each_request_is_logged_with_timing(client, caplog):
    caplog.set_level(logging.INFO, logger="gridbrick")
    client.get("/api/v1/meta", headers={"X-Request-ID": "timed"})
    record = next(r for r in caplog.records if r.getMessage() == "request")
    assert record.fields["request_id"] == "timed"
    assert record.fields["path"] == "/api/v1/meta"
    assert record.fields["status"] == 200
    assert record.fields["duration_ms"] >= 0


def test_unhandled_errors_return_envelope_and_are_logged(client, caplog):
    caplog.set_level(logging.INFO, logger="gridbrick")
    res = client.get("/api/v1/boom", headers={"X-Request-ID": "boom-1"})
    assert res.status_code == 500
    assert res.json() == {
        "error": {"code": "internal_error", "message": "Something went wrong on our side.", "request_id": "boom-1"}
    }
    errors = [r for r in caplog.records if r.levelno == logging.ERROR]
    assert errors and errors[0].exc_info is not None


def test_json_formatter_merges_fields():
    record = logging.LogRecord("gridbrick", logging.INFO, __file__, 1, "request", None, None)
    record.fields = {"status": 200, "path": "/api/v1/meta"}
    assert json.loads(JsonFormatter().format(record)) == {
        "level": "info",
        "logger": "gridbrick",
        "message": "request",
        "status": 200,
        "path": "/api/v1/meta",
    }
