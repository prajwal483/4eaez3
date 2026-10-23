"""Where the data comes from: a committed snapshot of the January 2026 window, or Elexon live."""

from dataclasses import dataclass
from functools import lru_cache
from pathlib import Path

import httpx
import pandas as pd

from app.config import (
    ACTUALS_FROM,
    ACTUALS_TO,
    FORECASTS_PUBLISHED_FROM,
    FORECASTS_PUBLISHED_TO,
    SNAPSHOT_DIR,
)
from app.elexon import fetch_actuals, fetch_forecasts

ACTUALS_FILE = "actuals.csv.gz"
FORECASTS_FILE = "forecasts.csv.gz"


@dataclass(frozen=True)
class Dataset:
    actuals: pd.DataFrame
    forecasts: pd.DataFrame
    source: str


def save_snapshot(ds: Dataset, directory: Path) -> None:
    directory.mkdir(parents=True, exist_ok=True)
    ds.actuals.to_csv(directory / ACTUALS_FILE, index=False)
    ds.forecasts.to_csv(directory / FORECASTS_FILE, index=False)


def load_snapshot(directory: Path) -> Dataset:
    actuals = pd.read_csv(directory / ACTUALS_FILE)
    actuals["start_time"] = pd.to_datetime(actuals["start_time"], utc=True)
    forecasts = pd.read_csv(directory / FORECASTS_FILE)
    for col in ("publish_time", "start_time"):
        forecasts[col] = pd.to_datetime(forecasts[col], utc=True)
    return Dataset(actuals=actuals, forecasts=forecasts, source="snapshot")


def fetch_live(client: httpx.Client) -> Dataset:
    return Dataset(
        actuals=fetch_actuals(client, ACTUALS_FROM, ACTUALS_TO),
        forecasts=fetch_forecasts(client, FORECASTS_PUBLISHED_FROM, FORECASTS_PUBLISHED_TO),
        source="live",
    )


@lru_cache(maxsize=1)
def get_dataset() -> Dataset:
    """January 2026 is history, so the snapshot is authoritative; live fetch is the fallback."""
    if (SNAPSHOT_DIR / ACTUALS_FILE).exists() and (SNAPSHOT_DIR / FORECASTS_FILE).exists():
        return load_snapshot(SNAPSHOT_DIR)
    with httpx.Client() as client:
        return fetch_live(client)
