from datetime import date, datetime, timezone

import httpx
import pandas as pd

from app.elexon import fetch_actuals, fetch_forecasts, parse_actuals, parse_forecasts


def test_parse_actuals_keeps_wind_and_latest_publish():
    records = [
        {"publishTime": "2026-01-10T00:30:00Z", "startTime": "2026-01-10T00:00:00Z", "fuelType": "WIND", "generation": 100},
        {"publishTime": "2026-01-10T01:00:00Z", "startTime": "2026-01-10T00:00:00Z", "fuelType": "WIND", "generation": 110},
        {"publishTime": "2026-01-10T01:00:00Z", "startTime": "2026-01-10T00:30:00Z", "fuelType": "CCGT", "generation": 999},
        {"publishTime": "2026-01-10T01:00:00Z", "startTime": "2026-01-10T00:30:00Z", "fuelType": "WIND", "generation": 120},
    ]
    df = parse_actuals(records)
    assert list(df.columns) == ["start_time", "actual_mw"]
    assert str(df["start_time"].dtype) == "datetime64[ns, UTC]"
    assert df["actual_mw"].tolist() == [110.0, 120.0]


def test_parse_actuals_empty():
    df = parse_actuals([])
    assert list(df.columns) == ["start_time", "actual_mw"]
    assert df.empty


def test_parse_forecasts_dedupes_and_sorts():
    records = [
        {"publishTime": "2026-01-10T09:30:00Z", "startTime": "2026-01-11T01:00:00Z", "generation": 5},
        {"publishTime": "2026-01-10T06:30:00Z", "startTime": "2026-01-11T00:00:00Z", "generation": 3},
        {"publishTime": "2026-01-10T06:30:00Z", "startTime": "2026-01-11T00:00:00Z", "generation": 4},
    ]
    df = parse_forecasts(records)
    assert list(df.columns) == ["publish_time", "start_time", "forecast_mw"]
    assert len(df) == 2
    assert df.iloc[0]["forecast_mw"] == 4.0
    assert df.iloc[0]["start_time"] == pd.Timestamp("2026-01-11T00:00:00Z")


def test_fetch_actuals_requests_wind_for_settlement_dates():
    seen = {}

    def handler(request: httpx.Request) -> httpx.Response:
        seen["url"] = request.url
        return httpx.Response(200, json=[
            {"publishTime": "2026-01-01T00:30:00Z", "startTime": "2026-01-01T00:00:00Z", "fuelType": "WIND", "generation": 9000},
        ])

    with httpx.Client(transport=httpx.MockTransport(handler)) as client:
        df = fetch_actuals(client, date(2026, 1, 1), date(2026, 1, 2))
    assert seen["url"].path.endswith("/FUELHH/stream")
    assert seen["url"].params["fuelType"] == "WIND"
    assert seen["url"].params["settlementDateFrom"] == "2026-01-01"
    assert seen["url"].params["settlementDateTo"] == "2026-01-02"
    assert df["actual_mw"].tolist() == [9000.0]


def test_fetch_forecasts_requests_publish_window():
    seen = {}

    def handler(request: httpx.Request) -> httpx.Response:
        seen["url"] = request.url
        return httpx.Response(200, json=[])

    with httpx.Client(transport=httpx.MockTransport(handler)) as client:
        df = fetch_forecasts(
            client,
            datetime(2026, 1, 1, tzinfo=timezone.utc),
            datetime(2026, 1, 2, tzinfo=timezone.utc),
        )
    assert seen["url"].path.endswith("/WINDFOR/stream")
    assert seen["url"].params["publishDateTimeFrom"] == "2026-01-01T00:00:00Z"
    assert seen["url"].params["publishDateTimeTo"] == "2026-01-02T00:00:00Z"
    assert df.empty
