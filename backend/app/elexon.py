from datetime import date, datetime

import httpx
import pandas as pd

from app.config import ELEXON_BASE

TIMEOUT_SECONDS = 60


def _iso_utc(value: datetime) -> str:
    return value.strftime("%Y-%m-%dT%H:%M:%SZ")


def parse_actuals(records: list[dict]) -> pd.DataFrame:
    # Elexon republishes some periods; keep the latest value.
    if not records:
        return pd.DataFrame(
            {
                "start_time": pd.Series(dtype="datetime64[ns, UTC]"),
                "actual_mw": pd.Series(dtype=float),
            }
        )
    df = pd.DataFrame.from_records(records)
    df = df[df["fuelType"] == "WIND"]
    df = df.sort_values("publishTime").drop_duplicates("startTime", keep="last")
    out = pd.DataFrame(
        {
            "start_time": pd.to_datetime(df["startTime"], utc=True),
            "actual_mw": df["generation"].astype(float),
        }
    )
    return out.sort_values("start_time").reset_index(drop=True)


def parse_forecasts(records: list[dict]) -> pd.DataFrame:
    if not records:
        return pd.DataFrame(
            {
                "publish_time": pd.Series(dtype="datetime64[ns, UTC]"),
                "start_time": pd.Series(dtype="datetime64[ns, UTC]"),
                "forecast_mw": pd.Series(dtype=float),
            }
        )
    df = pd.DataFrame.from_records(records)
    out = pd.DataFrame(
        {
            "publish_time": pd.to_datetime(df["publishTime"], utc=True),
            "start_time": pd.to_datetime(df["startTime"], utc=True),
            "forecast_mw": df["generation"].astype(float),
        }
    )
    out = out.drop_duplicates(["publish_time", "start_time"], keep="last")
    return out.sort_values(["start_time", "publish_time"]).reset_index(drop=True)


def fetch_actuals(client: httpx.Client, date_from: date, date_to: date) -> pd.DataFrame:
    resp = client.get(
        f"{ELEXON_BASE}/FUELHH/stream",
        params={
            "settlementDateFrom": date_from.isoformat(),
            "settlementDateTo": date_to.isoformat(),
            "fuelType": "WIND",
        },
        timeout=TIMEOUT_SECONDS,
    )
    resp.raise_for_status()
    return parse_actuals(resp.json())


def fetch_forecasts(client: httpx.Client, published_from: datetime, published_to: datetime) -> pd.DataFrame:
    resp = client.get(
        f"{ELEXON_BASE}/WINDFOR/stream",
        params={
            "publishDateTimeFrom": _iso_utc(published_from),
            "publishDateTimeTo": _iso_utc(published_to),
        },
        timeout=TIMEOUT_SECONDS,
    )
    resp.raise_for_status()
    return parse_forecasts(resp.json())
