# GridBrick Wind Forecast Monitor Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Build a web app for a UK utility's day-ahead power buying team. It shows the latest GB national wind forecast available at the day-ahead gate closure, and it measures how accurate those forecasts were for January 2026 decisions.

**Architecture:** A Python FastAPI backend loads Elexon BMRS actuals (FUELHH, fuelType WIND) and forecasts (WINDFOR) from a committed snapshot of the January 2026 window, with live API fetch as a fallback. Pure pandas functions do the analytics (horizon selection, error metrics, empirical P10/P90 bands). A React + TypeScript (Vite) frontend with Recharts has two views: **Day-ahead decision** and **Forecast accuracy**. One multi-stage Docker image builds the frontend and serves it from FastAPI. The image deploys to Heroku's container stack.

**Tech Stack:** Python 3.12 (Docker) / 3.13 (local), FastAPI 0.115, pandas 2.2, httpx 0.28, pytest 8; Node 20, React 18, TypeScript 5.6, Vite 5, Recharts 2, Vitest 2 + Testing Library; Docker, Heroku (container stack).

## Global Constraints

- Frontend must be React; backend must be Python. (spec §2.2)
- Data: only national-level wind actuals and forecasts from Elexon. Actuals come from `FUELHH` filtered to `"fuelType": "WIND"` (fields `startTime`, `generation`). Forecasts come from `WINDFOR` (fields `startTime`, `publishTime`, `generation`). No other data sources.
- Scope: "data relevant only for purchase decisions to be made in January 2026". Decisions happen on D-1 throughout January 2026, so delivery days run **2026-01-02 … 2026-02-01**.
- Day-ahead gate closure defaults to **11:00 UK time on D-1** (GB day-ahead auction). UK time equals UTC in January. All times are stored and shown in UTC.
- Error sign convention everywhere: `error_mw = forecast_mw - actual_mw` (positive means wind was over-forecast, so the buyer is short).
- Use Docker. Deploy to Vercel or Heroku (this plan uses Heroku container stack).
- README must contain: details of the files and directories, how to start the app, the link to the deployed app, and an explicit statement that AI tools were used.
- The public GitHub repo must have an anonymous random name (e.g. `kjhwr`).
- Total effort budget: ≤ 16 hours.
- Working directory: `C:\Users\prajwal\GRIDBRICK` (Git Bash on Windows). Activate the Python venv with `source backend/.venv/Scripts/activate`.

## File Structure

```
GRIDBRICK/
├── .gitignore / .dockerignore
├── Dockerfile                 # multi-stage: build frontend, run FastAPI serving API + static files
├── docker-compose.yml         # local one-command run
├── heroku.yml                 # Heroku container-stack build definition
├── README.md
├── docs/demo-script.md        # outline for the 10-minute video (client pitch + tech review)
├── backend/
│   ├── requirements.txt / requirements-dev.txt / pytest.ini
│   ├── app/
│   │   ├── config.py          # constants: Elexon URL, data windows, gate closure, paths
│   │   ├── elexon.py          # HTTP fetch + parse raw JSON into canonical DataFrames
│   │   ├── store.py           # Dataset type, snapshot save/load, cached get_dataset()
│   │   ├── analytics.py       # pure evaluation functions (no I/O)
│   │   ├── schemas.py         # pydantic response models (API contract)
│   │   └── main.py            # FastAPI app factory, routes, static mount
│   ├── data/                  # committed snapshot: actuals.csv.gz, forecasts.csv.gz
│   ├── scripts/snapshot.py    # refresh the snapshot from Elexon
│   └── tests/                 # conftest (synthetic dataset), test_elexon, test_store, test_analytics, test_api
└── frontend/
    ├── package.json / tsconfig.json / vite.config.ts / index.html
    └── src/
        ├── main.tsx / App.tsx / index.css
        ├── types.ts           # mirrors backend/app/schemas.py
        ├── api.ts             # typed fetch client
        ├── useAsync.ts        # tiny data-loading hook
        ├── format.ts          # number/date formatting + delivery-date list
        ├── setupTests.ts / test/fixtures.ts
        └── components/MetricCards.tsx, DecisionView.tsx, AccuracyView.tsx (+ *.test.tsx)
```

**Canonical DataFrames (used by every backend task):**
- `actuals`: columns `start_time` (`datetime64[ns, UTC]`), `actual_mw` (float). One row per half hour, sorted by `start_time`.
- `forecasts`: columns `publish_time` (`datetime64[ns, UTC]`), `start_time` (`datetime64[ns, UTC]`), `forecast_mw` (float). One row per (publish_time, start_time), sorted by `start_time, publish_time`.

---

### Task 1: Repo scaffold, config, and Elexon parsing

**Files:**
- Create: `.gitignore`, `backend/requirements.txt`, `backend/requirements-dev.txt`, `backend/pytest.ini`
- Create: `backend/app/__init__.py` (empty), `backend/app/config.py`, `backend/app/elexon.py`
- Test: `backend/tests/__init__.py` (empty), `backend/tests/test_elexon.py`

**Interfaces:**
- Produces: `app.config` constants `ELEXON_BASE`, `FIRST_DELIVERY_DATE`, `LAST_DELIVERY_DATE`, `ACTUALS_FROM`, `ACTUALS_TO`, `FORECASTS_PUBLISHED_FROM`, `FORECASTS_PUBLISHED_TO`, `DEFAULT_GATE_CLOSURE_HOUR_UTC`, `MAX_HORIZON_HOURS`, `SNAPSHOT_DIR`, `STATIC_DIR`
- Produces: `parse_actuals(records: list[dict]) -> pd.DataFrame`, `parse_forecasts(records: list[dict]) -> pd.DataFrame`, `fetch_actuals(client: httpx.Client, date_from: date, date_to: date) -> pd.DataFrame`, `fetch_forecasts(client: httpx.Client, published_from: datetime, published_to: datetime) -> pd.DataFrame`

- [ ] **Step 1: Initialise git and dependency files**

```bash
cd /c/Users/prajwal/GRIDBRICK && git init -b main
```

`.gitignore`:
```
.claude/settings.local.json
__pycache__/
*.pyc
backend/.venv/
backend/static/
.pytest_cache/
frontend/node_modules/
frontend/dist/
.env
```

`backend/requirements.txt`:
```
fastapi==0.115.6
uvicorn[standard]==0.32.1
pandas==2.2.3
numpy==2.2.1
httpx==0.28.1
```

`backend/requirements-dev.txt`:
```
-r requirements.txt
pytest==8.3.4
```

`backend/pytest.ini`:
```ini
[pytest]
testpaths = tests
pythonpath = .
```

```bash
cd backend && python -m venv .venv && source .venv/Scripts/activate && pip install -r requirements-dev.txt
```
Expected: installs with no errors.

- [ ] **Step 2: Write `backend/app/config.py`**

```python
from datetime import date, datetime, timezone
from pathlib import Path

ELEXON_BASE = "https://data.elexon.co.uk/bmrs/api/v1/datasets"

# Purchase decisions are made on D-1 throughout January 2026, so delivery days run 2 Jan - 1 Feb.
FIRST_DELIVERY_DATE = date(2026, 1, 2)
LAST_DELIVERY_DATE = date(2026, 2, 1)

# Extra history before the window lets early-January decisions use prior forecast errors.
ACTUALS_FROM = date(2025, 12, 25)
ACTUALS_TO = date(2026, 2, 2)
FORECASTS_PUBLISHED_FROM = datetime(2025, 12, 23, tzinfo=timezone.utc)
FORECASTS_PUBLISHED_TO = datetime(2026, 2, 1, 12, tzinfo=timezone.utc)

# GB day-ahead auction gate closure is 11:00 UK time on D-1; UK time equals UTC in January.
DEFAULT_GATE_CLOSURE_HOUR_UTC = 11
MAX_HORIZON_HOURS = 48

BACKEND_DIR = Path(__file__).resolve().parent.parent
SNAPSHOT_DIR = BACKEND_DIR / "data"
STATIC_DIR = BACKEND_DIR / "static"
```

- [ ] **Step 3: Write the failing tests `backend/tests/test_elexon.py`**

```python
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
```

- [ ] **Step 4: Run tests to verify they fail**

Run: `cd backend && pytest tests/test_elexon.py -v`
Expected: FAIL with `ModuleNotFoundError: No module named 'app.elexon'`

- [ ] **Step 5: Write `backend/app/elexon.py`**

```python
"""Fetch Elexon BMRS datasets and normalise them into the canonical DataFrames."""
from datetime import date, datetime

import httpx
import pandas as pd

from app.config import ELEXON_BASE

TIMEOUT_SECONDS = 60


def _iso_utc(value: datetime) -> str:
    return value.strftime("%Y-%m-%dT%H:%M:%SZ")


def parse_actuals(records: list[dict]) -> pd.DataFrame:
    """Wind outturn per half hour; when a period was republished, keep the latest value."""
    if not records:
        return pd.DataFrame({
            "start_time": pd.Series(dtype="datetime64[ns, UTC]"),
            "actual_mw": pd.Series(dtype=float),
        })
    df = pd.DataFrame.from_records(records)
    df = df[df["fuelType"] == "WIND"]
    df = df.sort_values("publishTime").drop_duplicates("startTime", keep="last")
    out = pd.DataFrame({
        "start_time": pd.to_datetime(df["startTime"], utc=True),
        "actual_mw": df["generation"].astype(float),
    })
    return out.sort_values("start_time").reset_index(drop=True)


def parse_forecasts(records: list[dict]) -> pd.DataFrame:
    """One row per (forecast run, target hour)."""
    if not records:
        return pd.DataFrame({
            "publish_time": pd.Series(dtype="datetime64[ns, UTC]"),
            "start_time": pd.Series(dtype="datetime64[ns, UTC]"),
            "forecast_mw": pd.Series(dtype=float),
        })
    df = pd.DataFrame.from_records(records)
    out = pd.DataFrame({
        "publish_time": pd.to_datetime(df["publishTime"], utc=True),
        "start_time": pd.to_datetime(df["startTime"], utc=True),
        "forecast_mw": df["generation"].astype(float),
    })
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
```

- [ ] **Step 6: Run tests to verify they pass**

Run: `cd backend && pytest tests/test_elexon.py -v`
Expected: 5 passed

- [ ] **Step 7: Commit**

```bash
git add .gitignore backend/requirements.txt backend/requirements-dev.txt backend/pytest.ini backend/app backend/tests
git commit -m "feat(backend): add config and Elexon FUELHH/WINDFOR parsing"
```

---

### Task 2: Dataset store and committed January snapshot

**Files:**
- Create: `backend/app/store.py`, `backend/scripts/__init__.py` (empty), `backend/scripts/snapshot.py`
- Create: `backend/tests/conftest.py`, `backend/tests/test_store.py`
- Create (generated): `backend/data/actuals.csv.gz`, `backend/data/forecasts.csv.gz`

**Interfaces:**
- Consumes: `fetch_actuals`, `fetch_forecasts` (Task 1); config constants.
- Produces: `Dataset(actuals: pd.DataFrame, forecasts: pd.DataFrame, source: str)` (frozen dataclass; `source` is `"snapshot"` or `"live"`), `save_snapshot(ds: Dataset, directory: Path) -> None`, `load_snapshot(directory: Path) -> Dataset`, `fetch_live(client: httpx.Client) -> Dataset`, `get_dataset() -> Dataset` (lru-cached).
- Produces (tests): `make_dataset() -> Dataset` and pytest fixture `dataset` in `tests/conftest.py`. The synthetic data is defined as:
  - actuals: constant 1000 MW every 30 min from 2025-12-31 00:00 to 2026-01-06 00:00 (exclusive).
  - forecasts: runs published every 6 h from 2025-12-31 00:00 to 2026-01-03 18:00 (16 runs). Each run has hourly targets at publish + k h for k = 0..48, with `forecast_mw = 1000 + 10*k`. So **error equals 10 × horizon hours**.

- [ ] **Step 1: Write `backend/tests/conftest.py`**

```python
import pandas as pd
import pytest

from app.store import Dataset


def make_dataset() -> Dataset:
    """Synthetic data where forecast error is exactly 10 MW per hour of horizon."""
    actual_times = pd.date_range("2025-12-31", "2026-01-06", freq="30min", tz="UTC", inclusive="left")
    actuals = pd.DataFrame({"start_time": actual_times, "actual_mw": 1000.0})
    rows = []
    for publish in pd.date_range("2025-12-31", "2026-01-03 18:00", freq="6h", tz="UTC"):
        for k in range(49):
            rows.append({
                "publish_time": publish,
                "start_time": publish + pd.Timedelta(hours=k),
                "forecast_mw": 1000.0 + 10 * k,
            })
    forecasts = pd.DataFrame(rows).sort_values(["start_time", "publish_time"]).reset_index(drop=True)
    return Dataset(actuals=actuals, forecasts=forecasts, source="snapshot")


@pytest.fixture
def dataset() -> Dataset:
    return make_dataset()
```

- [ ] **Step 2: Write failing test `backend/tests/test_store.py`**

```python
import pandas as pd

from app.store import load_snapshot, save_snapshot


def test_snapshot_round_trip(tmp_path, dataset):
    save_snapshot(dataset, tmp_path)
    loaded = load_snapshot(tmp_path)
    assert loaded.source == "snapshot"
    pd.testing.assert_frame_equal(loaded.actuals, dataset.actuals)
    pd.testing.assert_frame_equal(loaded.forecasts, dataset.forecasts)
```

- [ ] **Step 3: Run test to verify it fails**

Run: `cd backend && pytest tests/test_store.py -v`
Expected: FAIL with `ModuleNotFoundError: No module named 'app.store'` (raised from conftest import)

- [ ] **Step 4: Write `backend/app/store.py`**

```python
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
```

- [ ] **Step 5: Run test to verify it passes**

Run: `cd backend && pytest tests/test_store.py -v`
Expected: 1 passed

- [ ] **Step 6: Write `backend/scripts/snapshot.py`**

```python
"""Download the January 2026 decision window from Elexon into backend/data."""
import httpx

from app.config import SNAPSHOT_DIR
from app.store import fetch_live, save_snapshot


def main() -> None:
    with httpx.Client() as client:
        ds = fetch_live(client)
    save_snapshot(ds, SNAPSHOT_DIR)
    print(f"actuals: {len(ds.actuals)} rows, forecasts: {len(ds.forecasts)} rows -> {SNAPSHOT_DIR}")


if __name__ == "__main__":
    main()
```

- [ ] **Step 7: Generate the real snapshot**

Run: `cd backend && python -m scripts.snapshot`
Expected (approximately, verified against the live API on 2026-10-23): `actuals: 1920 rows, forecasts: 23725 rows -> ...\backend\data`

- [ ] **Step 8: Run the whole suite and commit**

Run: `cd backend && pytest -v` → all pass.

```bash
git add backend/app/store.py backend/scripts backend/tests/conftest.py backend/tests/test_store.py backend/data
git commit -m "feat(backend): add dataset store and January 2026 Elexon snapshot"
```

---

### Task 3: Core analytics — horizon selection, joins, metrics, histogram

**Files:**
- Create: `backend/app/analytics.py`
- Test: `backend/tests/test_analytics.py`

**Interfaces:**
- Consumes: canonical frames; `make_dataset` fixture `dataset` (Task 2).
- Produces:
  - `forecasts_at_horizon(forecasts: pd.DataFrame, min_horizon_hours: float) -> pd.DataFrame`: columns `publish_time, start_time, forecast_mw, horizon_hours`. For each target, it keeps the latest forecast published at least `min_horizon_hours` earlier.
  - `join_actuals(forecast_rows: pd.DataFrame, actuals: pd.DataFrame) -> pd.DataFrame`: adds `actual_mw` (NaN if missing) and `error_mw`.
  - `within(df: pd.DataFrame, start: pd.Timestamp, end: pd.Timestamp) -> pd.DataFrame`: filters `start <= start_time < end`.
  - `error_metrics(joined: pd.DataFrame) -> dict` with keys `n, mae_mw, rmse_mw, bias_mw, wape_pct, p50_abs_mw, p90_abs_mw`. Values are floats rounded to 1 dp, or None when there is no data.
  - `error_histogram(joined: pd.DataFrame, bin_width_mw: int = 250) -> list[dict]` with keys `bin_start_mw, bin_end_mw, count`.
  - `_r(x) -> float | None`: rounds to 1 dp and maps NaN/None to None.
  - Constants `HOUR`, `ACTUAL_PUBLICATION_LAG`.

- [ ] **Step 1: Write failing tests `backend/tests/test_analytics.py`**

```python
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
```

- [ ] **Step 2: Run tests to verify they fail**

Run: `cd backend && pytest tests/test_analytics.py -v`
Expected: FAIL with `ModuleNotFoundError: No module named 'app.analytics'`

- [ ] **Step 3: Write `backend/app/analytics.py`**

```python
"""Pure forecast-evaluation functions over the canonical actuals/forecasts frames.

Sign convention: error_mw = forecast_mw - actual_mw. Positive error means wind was
over-forecast, i.e. the buyer would be short and must procure more.
"""
import math

import numpy as np
import pandas as pd

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
        return {"n": 0, "mae_mw": None, "rmse_mw": None, "bias_mw": None,
                "wape_pct": None, "p50_abs_mw": None, "p90_abs_mw": None}
    err = df["error_mw"]
    abs_err = err.abs()
    total_actual = df["actual_mw"].abs().sum()
    return {
        "n": int(n),
        "mae_mw": _r(abs_err.mean()),
        "rmse_mw": _r(math.sqrt((err ** 2).mean())),
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
```

- [ ] **Step 4: Run tests to verify they pass**

Run: `cd backend && pytest tests/test_analytics.py -v`
Expected: 8 passed

- [ ] **Step 5: Commit**

```bash
git add backend/app/analytics.py backend/tests/test_analytics.py
git commit -m "feat(backend): add forecast horizon selection and error metrics"
```

---

### Task 4: Decision and accuracy views — gate-closure forecast, P10/P90 band, horizon profile

**Files:**
- Modify: `backend/app/analytics.py` (append)
- Test: `backend/tests/test_analytics_views.py`

**Interfaces:**
- Consumes: everything from Task 3.
- Produces:
  - `ErrorBand(low_error_mw: float | None, high_error_mw: float | None, samples: int)` (frozen dataclass)
  - `error_band(forecasts, actuals, cutoff: pd.Timestamp, min_horizon_hours: float, lookback_days: int = 14, min_samples: int = 48, quantiles: tuple[float, float] = (0.1, 0.9)) -> ErrorBand`
  - `decision_view(forecasts, actuals, delivery_date: date, gate_hour_utc: int) -> dict` with keys `delivery_date, gate_closure, forecast_published_at, band_samples, points[{start_time, forecast_mw, actual_mw, low_mw, high_mw}], forecast_energy_mwh, actual_energy_mwh, metrics`
  - `accuracy_view(forecasts, actuals, horizon_hours: int, start: pd.Timestamp, end: pd.Timestamp) -> dict` with keys `horizon_hours, points[{start_time, publish_time, forecast_mw, actual_mw, error_mw}], metrics, histogram`
  - `horizon_profile(forecasts, actuals, start, end, horizons: Iterable[int] = range(0, MAX_HORIZON_HOURS + 1, 3)) -> list[dict]` with keys `horizon_hours, metrics, p10_error_mw, p90_error_mw`

Background for the implementer: on D-1 the buyer can only use forecasts published **at or before gate closure**. The likely range shown around the forecast comes from recent errors at a similar horizon, using only actuals already published by gate closure, so it never peeks into the future. Since `actual = forecast - error`, the low generation bound uses the **high** error quantile.

- [ ] **Step 1: Write failing tests `backend/tests/test_analytics_views.py`**

```python
from datetime import date

import pandas as pd

from app.analytics import accuracy_view, decision_view, error_band, horizon_profile

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
    view = decision_view(dataset.forecasts, dataset.actuals, date(2026, 1, 3), 11)
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
    # Only 46 known pairs before this gate closure (< 48), so no band yet.
    assert view["band_samples"] == 46
    assert first["low_mw"] is None and first["high_mw"] is None


def test_decision_view_band_brackets_forecast_minus_error(dataset):
    view = decision_view(dataset.forecasts, dataset.actuals, date(2026, 1, 4), 11)
    assert view["band_samples"] == 70
    for p in view["points"]:
        assert p["forecast_mw"] - 180 <= p["low_mw"] <= p["high_mw"] <= p["forecast_mw"] - 130


def test_decision_view_partial_actuals_gives_none_energy(dataset):
    partial = dataset.actuals[dataset.actuals["start_time"] < T("2026-01-03T12:00Z")]
    view = decision_view(dataset.forecasts, partial, date(2026, 1, 3), 11)
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
    rows = horizon_profile(dataset.forecasts, dataset.actuals,
                           T("2026-01-02T00:00Z"), T("2026-01-03T00:00Z"), horizons=[0, 24])
    assert [r["horizon_hours"] for r in rows] == [0, 24]
    assert rows[0]["metrics"]["mae_mw"] == 25.0
    assert rows[1]["metrics"]["mae_mw"] == 265.0
    assert rows[1]["p10_error_mw"] <= rows[1]["p90_error_mw"]
```

- [ ] **Step 2: Run tests to verify they fail**

Run: `cd backend && pytest tests/test_analytics_views.py -v`
Expected: FAIL with `ImportError: cannot import name 'accuracy_view'`

- [ ] **Step 3: Append to `backend/app/analytics.py`**

Add these imports at the top of the file, next to the existing ones:
```python
from collections.abc import Iterable
from dataclasses import dataclass
from datetime import date

from app.config import MAX_HORIZON_HOURS
```

Append to the end of the file:
```python
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


def decision_view(forecasts: pd.DataFrame, actuals: pd.DataFrame, delivery_date: date, gate_hour_utc: int) -> dict:
    day_start = pd.Timestamp(delivery_date.isoformat(), tz="UTC")
    day_end = day_start + pd.Timedelta(days=1)
    cutoff = day_start - pd.Timedelta(days=1) + pd.Timedelta(hours=gate_hour_utc)

    eligible = forecasts[forecasts["publish_time"] <= cutoff]
    latest = within(eligible, day_start, day_end)
    latest = latest.sort_values("publish_time").drop_duplicates("start_time", keep="last").sort_values("start_time")
    joined = join_actuals(latest, actuals)
    band = error_band(forecasts, actuals, cutoff, (day_start - cutoff) / HOUR)

    points = []
    for row in joined.itertuples(index=False):
        low = high = None
        if band.low_error_mw is not None:
            # actual = forecast - error, so the high error quantile gives the low generation bound.
            low = max(0.0, row.forecast_mw - band.high_error_mw)
            high = row.forecast_mw - band.low_error_mw
        points.append({
            "start_time": row.start_time.to_pydatetime(),
            "forecast_mw": _r(row.forecast_mw),
            "actual_mw": _r(row.actual_mw),
            "low_mw": _r(low),
            "high_mw": _r(high),
        })

    complete_actuals = len(joined) > 0 and bool(joined["actual_mw"].notna().all())
    return {
        "delivery_date": delivery_date,
        "gate_closure": cutoff.to_pydatetime(),
        "forecast_published_at": latest["publish_time"].max().to_pydatetime() if len(latest) else None,
        "band_samples": band.samples,
        "points": points,
        # WINDFOR is hourly, so summing MW over the points gives MWh.
        "forecast_energy_mwh": _r(joined["forecast_mw"].sum()),
        "actual_energy_mwh": _r(joined["actual_mw"].sum()) if complete_actuals else None,
        "metrics": error_metrics(joined),
    }


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
        out.append({
            "horizon_hours": h,
            "metrics": error_metrics(rows),
            "p10_error_mw": _r(p10),
            "p90_error_mw": _r(p90),
        })
    return out
```

- [ ] **Step 4: Run tests to verify they pass**

Run: `cd backend && pytest -v`
Expected: all tests pass (test_elexon 5, test_store 1, test_analytics 8, test_analytics_views 7).

- [ ] **Step 5: Sanity-check against real data**

Run:
```bash
cd backend && python -c "
from datetime import date
import pandas as pd
from app.store import get_dataset
from app.analytics import decision_view, horizon_profile
ds = get_dataset()
v = decision_view(ds.forecasts, ds.actuals, date(2026,1,15), 11)
print(v['forecast_published_at'], v['band_samples'], v['metrics'])
for r in horizon_profile(ds.forecasts, ds.actuals, pd.Timestamp('2026-01-02', tz='UTC'), pd.Timestamp('2026-02-02', tz='UTC'), [0, 12, 24, 36, 48]):
    print(r['horizon_hours'], r['metrics']['mae_mw'], r['metrics']['n'])
"
```
Expected: `forecast_published_at` is on 2026-01-14 at or before 11:00 UTC; `band_samples` ≥ 48; MAE grows broadly with horizon; n ≈ 744 per horizon. If n is far lower for a horizon, check the gaps in WINDFOR runs before going further.

- [ ] **Step 6: Commit**

```bash
git add backend/app/analytics.py backend/tests/test_analytics_views.py
git commit -m "feat(backend): add day-ahead decision view, error band and horizon profile"
```

---

### Task 5: FastAPI app — schemas, routes, static serving

**Files:**
- Create: `backend/app/schemas.py`, `backend/app/main.py`
- Test: `backend/tests/test_api.py`

**Interfaces:**
- Consumes: `Dataset`, `get_dataset` (Task 2); `decision_view`, `accuracy_view`, `horizon_profile` (Task 4); config constants (Task 1).
- Produces: `create_app(dataset_provider: Callable[[], Dataset] = get_dataset, static_dir: Path | None = STATIC_DIR) -> FastAPI` and module-level `app`. HTTP contract (all JSON; datetimes ISO-8601 with `Z`):
  - `GET /api/health` → `{"status": "ok"}`
  - `GET /api/meta` → `Meta`
  - `GET /api/decision?delivery_date=YYYY-MM-DD&gate_hour=0..23` (default 11) → `DecisionResponse`; 400 if the date is outside 2026-01-02..2026-02-01
  - `GET /api/accuracy?horizon=0..48&start=YYYY-MM-DD&end=YYYY-MM-DD` (horizon default 24; start/end inclusive, default to the delivery window) → `AccuracyResponse`
  - `GET /api/accuracy/by-horizon?start=&end=` → `list[HorizonRow]` (horizons 0, 3, …, 48)

- [ ] **Step 1: Write `backend/app/schemas.py`**

```python
"""API response contract. Mirrored by frontend/src/types.ts."""
from datetime import date, datetime
from typing import Literal

from pydantic import BaseModel


class Metrics(BaseModel):
    n: int
    mae_mw: float | None
    rmse_mw: float | None
    bias_mw: float | None
    wape_pct: float | None
    p50_abs_mw: float | None
    p90_abs_mw: float | None


class DecisionPoint(BaseModel):
    start_time: datetime
    forecast_mw: float
    actual_mw: float | None
    low_mw: float | None
    high_mw: float | None


class DecisionResponse(BaseModel):
    delivery_date: date
    gate_closure: datetime
    forecast_published_at: datetime | None
    band_samples: int
    points: list[DecisionPoint]
    forecast_energy_mwh: float | None
    actual_energy_mwh: float | None
    metrics: Metrics


class AccuracyPoint(BaseModel):
    start_time: datetime
    publish_time: datetime
    forecast_mw: float
    actual_mw: float | None
    error_mw: float | None


class HistogramBin(BaseModel):
    bin_start_mw: float
    bin_end_mw: float
    count: int


class AccuracyResponse(BaseModel):
    horizon_hours: int
    points: list[AccuracyPoint]
    metrics: Metrics
    histogram: list[HistogramBin]


class HorizonRow(BaseModel):
    horizon_hours: int
    metrics: Metrics
    p10_error_mw: float | None
    p90_error_mw: float | None


class Meta(BaseModel):
    first_delivery_date: date
    last_delivery_date: date
    default_gate_hour_utc: int
    max_horizon_hours: int
    forecast_runs: int
    data_source: Literal["snapshot", "live"]
```

- [ ] **Step 2: Write failing tests `backend/tests/test_api.py`**

```python
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
    assert body["default_gate_hour_utc"] == 11
    assert body["max_horizon_hours"] == 48
    assert body["forecast_runs"] == 16
    assert body["data_source"] == "snapshot"


def test_decision(client):
    res = client.get("/api/decision", params={"delivery_date": "2026-01-03"})
    assert res.status_code == 200
    body = res.json()
    assert body["gate_closure"].startswith("2026-01-02T11:00:00")
    assert body["forecast_published_at"].startswith("2026-01-02T06:00:00")
    assert len(body["points"]) == 24
    assert body["points"][0]["forecast_mw"] == 1180.0
    assert body["forecast_energy_mwh"] == 31080.0


def test_decision_rejects_date_outside_window(client):
    res = client.get("/api/decision", params={"delivery_date": "2026-03-01"})
    assert res.status_code == 400
    assert "2026-01-02" in res.json()["detail"]


def test_decision_rejects_bad_gate_hour(client):
    res = client.get("/api/decision", params={"delivery_date": "2026-01-03", "gate_hour": 24})
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
```

- [ ] **Step 3: Run tests to verify they fail**

Run: `cd backend && pytest tests/test_api.py -v`
Expected: FAIL with `ModuleNotFoundError: No module named 'app.main'`

- [ ] **Step 4: Write `backend/app/main.py`**

```python
"""HTTP layer: validates inputs, delegates to analytics, serves the built frontend."""
from collections.abc import Callable
from datetime import date, timedelta
from pathlib import Path

import pandas as pd
from fastapi import FastAPI, HTTPException, Query
from fastapi.staticfiles import StaticFiles

from app import analytics
from app.config import (
    DEFAULT_GATE_CLOSURE_HOUR_UTC,
    FIRST_DELIVERY_DATE,
    LAST_DELIVERY_DATE,
    MAX_HORIZON_HOURS,
    STATIC_DIR,
)
from app.schemas import AccuracyResponse, DecisionResponse, HorizonRow, Meta
from app.store import Dataset, get_dataset


def _window(start: date | None, end: date | None) -> tuple[pd.Timestamp, pd.Timestamp]:
    """Inclusive date range -> half-open UTC timestamp range."""
    start = start or FIRST_DELIVERY_DATE
    end = end or LAST_DELIVERY_DATE
    if start > end:
        raise HTTPException(status_code=400, detail="start must be on or before end")
    return (
        pd.Timestamp(start.isoformat(), tz="UTC"),
        pd.Timestamp((end + timedelta(days=1)).isoformat(), tz="UTC"),
    )


def create_app(
    dataset_provider: Callable[[], Dataset] = get_dataset,
    static_dir: Path | None = STATIC_DIR,
) -> FastAPI:
    app = FastAPI(title="GridBrick Wind Forecast Monitor")

    @app.get("/api/health")
    def health() -> dict:
        return {"status": "ok"}

    @app.get("/api/meta", response_model=Meta)
    def meta() -> Meta:
        ds = dataset_provider()
        return Meta(
            first_delivery_date=FIRST_DELIVERY_DATE,
            last_delivery_date=LAST_DELIVERY_DATE,
            default_gate_hour_utc=DEFAULT_GATE_CLOSURE_HOUR_UTC,
            max_horizon_hours=MAX_HORIZON_HOURS,
            forecast_runs=int(ds.forecasts["publish_time"].nunique()),
            data_source=ds.source,
        )

    @app.get("/api/decision", response_model=DecisionResponse)
    def decision(
        delivery_date: date,
        gate_hour: int = Query(DEFAULT_GATE_CLOSURE_HOUR_UTC, ge=0, le=23),
    ) -> dict:
        if not FIRST_DELIVERY_DATE <= delivery_date <= LAST_DELIVERY_DATE:
            raise HTTPException(
                status_code=400,
                detail=f"delivery_date must be between {FIRST_DELIVERY_DATE} and {LAST_DELIVERY_DATE}",
            )
        ds = dataset_provider()
        return analytics.decision_view(ds.forecasts, ds.actuals, delivery_date, gate_hour)

    @app.get("/api/accuracy", response_model=AccuracyResponse)
    def accuracy(
        horizon: int = Query(24, ge=0, le=MAX_HORIZON_HOURS),
        start: date | None = None,
        end: date | None = None,
    ) -> dict:
        lo, hi = _window(start, end)
        ds = dataset_provider()
        return analytics.accuracy_view(ds.forecasts, ds.actuals, horizon, lo, hi)

    @app.get("/api/accuracy/by-horizon", response_model=list[HorizonRow])
    def by_horizon(start: date | None = None, end: date | None = None) -> list[dict]:
        lo, hi = _window(start, end)
        ds = dataset_provider()
        return analytics.horizon_profile(ds.forecasts, ds.actuals, lo, hi)

    if static_dir is not None and static_dir.is_dir():
        app.mount("/", StaticFiles(directory=static_dir, html=True), name="static")
    return app


app = create_app()
```

- [ ] **Step 5: Run tests to verify they pass**

Run: `cd backend && pytest -v`
Expected: all pass (30 tests).

- [ ] **Step 6: Smoke-test against the real snapshot**

Run: `cd backend && uvicorn app.main:app --port 8000` (in a separate terminal), then:
```bash
curl -s localhost:8000/api/meta
curl -s "localhost:8000/api/decision?delivery_date=2026-01-15" | head -c 400
curl -s -o /dev/null -w "%{time_total}\n" "localhost:8000/api/accuracy/by-horizon"
```
Expected: meta shows `"data_source":"snapshot"` and about 325 forecast runs. The decision response has 24 points. by-horizon responds in under 2 s.

- [ ] **Step 7: Commit**

```bash
git add backend/app/schemas.py backend/app/main.py backend/tests/test_api.py
git commit -m "feat(backend): expose decision and accuracy API with FastAPI"
```

---

### Task 6: Frontend scaffold — tooling, types, API client, formatting

**Files:**
- Create: `frontend/package.json`, `frontend/tsconfig.json`, `frontend/vite.config.ts`, `frontend/index.html`
- Create: `frontend/src/main.tsx`, `frontend/src/index.css`, `frontend/src/setupTests.ts`
- Create: `frontend/src/types.ts`, `frontend/src/api.ts`, `frontend/src/useAsync.ts`, `frontend/src/format.ts`, `frontend/src/test/fixtures.ts`
- Create (placeholder until Task 7): `frontend/src/App.tsx`
- Test: `frontend/src/format.test.ts`, `frontend/src/api.test.ts`

**Interfaces:**
- Consumes: HTTP contract from Task 5.
- Produces:
  - Types `Metrics`, `DecisionPoint`, `DecisionResponse`, `AccuracyPoint`, `HistogramBin`, `AccuracyResponse`, `HorizonRow`, `Meta` (field names identical to `backend/app/schemas.py`; datetimes and dates are `string`).
  - `api.meta(): Promise<Meta>`, `api.decision(deliveryDate: string, gateHour: number): Promise<DecisionResponse>`, `api.accuracy(horizon: number): Promise<AccuracyResponse>`, `api.byHorizon(): Promise<HorizonRow[]>`
  - `useAsync<T>(load: () => Promise<T>, deps: DependencyList): { data: T | null; error: string | null; loading: boolean }`
  - `formatMw(v)`, `formatGwh(mwh)`, `formatPct(v)`, `formatUtc(iso)`, `formatHourUtc(iso)`, `formatDayHourUtc(iso)`, `deliveryDates(first, last): string[]`
  - Fixtures `metaFixture`, `decisionFixture`, `accuracyFixture`, `horizonFixture`

- [ ] **Step 1: Write tooling files**

`frontend/package.json`:
```json
{
  "name": "gridbrick-frontend",
  "private": true,
  "version": "0.1.0",
  "type": "module",
  "scripts": {
    "dev": "vite",
    "build": "tsc --noEmit && vite build",
    "test": "vitest run",
    "preview": "vite preview"
  },
  "dependencies": {
    "react": "^18.3.1",
    "react-dom": "^18.3.1",
    "recharts": "^2.13.3"
  },
  "devDependencies": {
    "@testing-library/dom": "^10.4.0",
    "@testing-library/jest-dom": "^6.6.3",
    "@testing-library/react": "^16.1.0",
    "@types/react": "^18.3.12",
    "@types/react-dom": "^18.3.1",
    "@vitejs/plugin-react": "^4.3.4",
    "jsdom": "^25.0.1",
    "typescript": "~5.6.3",
    "vite": "^5.4.11",
    "vitest": "^2.1.8"
  }
}
```

`frontend/tsconfig.json`:
```json
{
  "compilerOptions": {
    "target": "ES2020",
    "lib": ["ES2020", "DOM", "DOM.Iterable"],
    "module": "ESNext",
    "moduleResolution": "bundler",
    "jsx": "react-jsx",
    "strict": true,
    "noEmit": true,
    "skipLibCheck": true,
    "isolatedModules": true,
    "types": ["vitest/globals"]
  },
  "include": ["src", "vite.config.ts"]
}
```

`frontend/vite.config.ts`:
```ts
import react from "@vitejs/plugin-react";
import { defineConfig } from "vitest/config";

export default defineConfig({
  plugins: [react()],
  server: { proxy: { "/api": "http://localhost:8000" } },
  test: { environment: "jsdom", globals: true, setupFiles: "./src/setupTests.ts" },
});
```

`frontend/index.html`:
```html
<!doctype html>
<html lang="en">
  <head>
    <meta charset="UTF-8" />
    <meta name="viewport" content="width=device-width, initial-scale=1.0" />
    <title>GridBrick · Wind Forecast Monitor</title>
  </head>
  <body>
    <div id="root"></div>
    <script type="module" src="/src/main.tsx"></script>
  </body>
</html>
```

`frontend/src/main.tsx`:
```tsx
import { StrictMode } from "react";
import { createRoot } from "react-dom/client";
import App from "./App";
import "./index.css";

createRoot(document.getElementById("root")!).render(
  <StrictMode>
    <App />
  </StrictMode>,
);
```

`frontend/src/App.tsx` (temporary; replaced in Task 7):
```tsx
export default function App() {
  return <h1>GridBrick · Wind Forecast Monitor</h1>;
}
```

`frontend/src/setupTests.ts`:
```ts
import "@testing-library/jest-dom/vitest";

// Recharts' ResponsiveContainer needs ResizeObserver, which jsdom lacks.
class ResizeObserverStub {
  observe() {}
  unobserve() {}
  disconnect() {}
}
globalThis.ResizeObserver = ResizeObserverStub as unknown as typeof ResizeObserver;
```

`frontend/src/index.css`:
```css
:root {
  font-family: Inter, system-ui, -apple-system, "Segoe UI", sans-serif;
  color: #0f172a;
  background: #f1f5f9;
}
body { margin: 0; }
.app { max-width: 1200px; margin: 0 auto; padding: 24px; }
.header { display: flex; justify-content: space-between; align-items: flex-end; gap: 16px; flex-wrap: wrap; margin-bottom: 20px; }
.header h1 { margin: 0; font-size: 24px; }
.subtitle { margin: 4px 0 0; color: #475569; }
.tabs { display: flex; gap: 8px; }
.tabs button { border: 1px solid #cbd5e1; background: white; padding: 8px 16px; border-radius: 999px; cursor: pointer; font-weight: 600; color: #334155; }
.tabs button[aria-pressed="true"] { background: #0f172a; color: white; border-color: #0f172a; }
.controls { display: flex; gap: 16px; align-items: center; flex-wrap: wrap; margin-bottom: 16px; }
.controls select, .controls input[type="range"] { padding: 6px; font-size: 14px; }
.cards { display: grid; grid-template-columns: repeat(auto-fit, minmax(190px, 1fr)); gap: 12px; margin-bottom: 16px; }
.card { background: white; border-radius: 12px; padding: 14px 16px; box-shadow: 0 1px 2px rgb(15 23 42 / 0.08); }
.card-label { font-size: 12px; text-transform: uppercase; letter-spacing: 0.04em; color: #64748b; }
.card-value { font-size: 22px; font-weight: 700; margin-top: 4px; }
.card-hint { font-size: 12px; color: #64748b; margin-top: 4px; }
.panel { background: white; border-radius: 12px; padding: 16px; margin-bottom: 16px; box-shadow: 0 1px 2px rgb(15 23 42 / 0.08); }
.panel h2 { font-size: 16px; margin: 0 0 4px; }
.panel p { margin: 0 0 12px; color: #64748b; font-size: 13px; }
.grid-2 { display: grid; grid-template-columns: repeat(auto-fit, minmax(420px, 1fr)); gap: 16px; }
.muted { color: #64748b; font-size: 13px; }
.error { background: #fee2e2; color: #991b1b; padding: 12px; border-radius: 8px; margin-bottom: 16px; }
footer { color: #64748b; font-size: 12px; margin-top: 24px; }
```

Run: `cd frontend && npm install`
Expected: creates `package-lock.json` and `node_modules`, with no errors.

- [ ] **Step 2: Write `frontend/src/types.ts`**

```ts
// Mirrors backend/app/schemas.py. Datetimes are ISO-8601 UTC strings; dates are YYYY-MM-DD.
export interface Metrics {
  n: number;
  mae_mw: number | null;
  rmse_mw: number | null;
  bias_mw: number | null;
  wape_pct: number | null;
  p50_abs_mw: number | null;
  p90_abs_mw: number | null;
}

export interface DecisionPoint {
  start_time: string;
  forecast_mw: number;
  actual_mw: number | null;
  low_mw: number | null;
  high_mw: number | null;
}

export interface DecisionResponse {
  delivery_date: string;
  gate_closure: string;
  forecast_published_at: string | null;
  band_samples: number;
  points: DecisionPoint[];
  forecast_energy_mwh: number | null;
  actual_energy_mwh: number | null;
  metrics: Metrics;
}

export interface AccuracyPoint {
  start_time: string;
  publish_time: string;
  forecast_mw: number;
  actual_mw: number | null;
  error_mw: number | null;
}

export interface HistogramBin {
  bin_start_mw: number;
  bin_end_mw: number;
  count: number;
}

export interface AccuracyResponse {
  horizon_hours: number;
  points: AccuracyPoint[];
  metrics: Metrics;
  histogram: HistogramBin[];
}

export interface HorizonRow {
  horizon_hours: number;
  metrics: Metrics;
  p10_error_mw: number | null;
  p90_error_mw: number | null;
}

export interface Meta {
  first_delivery_date: string;
  last_delivery_date: string;
  default_gate_hour_utc: number;
  max_horizon_hours: number;
  forecast_runs: number;
  data_source: "snapshot" | "live";
}
```

- [ ] **Step 3: Write `frontend/src/test/fixtures.ts`**

```ts
import type { AccuracyResponse, DecisionResponse, HorizonRow, Meta, Metrics } from "../types";

export const metricsFixture: Metrics = {
  n: 744, mae_mw: 512.3, rmse_mw: 690.1, bias_mw: 120.4, wape_pct: 6.2, p50_abs_mw: 400, p90_abs_mw: 1100,
};

export const metaFixture: Meta = {
  first_delivery_date: "2026-01-02",
  last_delivery_date: "2026-02-01",
  default_gate_hour_utc: 11,
  max_horizon_hours: 48,
  forecast_runs: 325,
  data_source: "snapshot",
};

export const decisionFixture: DecisionResponse = {
  delivery_date: "2026-01-02",
  gate_closure: "2026-01-01T11:00:00Z",
  forecast_published_at: "2026-01-01T09:30:00Z",
  band_samples: 312,
  points: [
    { start_time: "2026-01-02T00:00:00Z", forecast_mw: 1000, actual_mw: 950, low_mw: 800, high_mw: 1100 },
    { start_time: "2026-01-02T01:00:00Z", forecast_mw: 1200, actual_mw: 1250, low_mw: 900, high_mw: 1300 },
  ],
  forecast_energy_mwh: 2200,
  actual_energy_mwh: 2200,
  metrics: { ...metricsFixture, n: 2, mae_mw: 50 },
};

export const accuracyFixture: AccuracyResponse = {
  horizon_hours: 24,
  points: [
    { start_time: "2026-01-02T00:00:00Z", publish_time: "2026-01-01T00:00:00Z", forecast_mw: 1000, actual_mw: 900, error_mw: 100 },
  ],
  metrics: metricsFixture,
  histogram: [{ bin_start_mw: 0, bin_end_mw: 250, count: 1 }],
};

export const horizonFixture: HorizonRow[] = [
  { horizon_hours: 0, metrics: { ...metricsFixture, mae_mw: 200 }, p10_error_mw: -300, p90_error_mw: 250 },
  { horizon_hours: 24, metrics: metricsFixture, p10_error_mw: -900, p90_error_mw: 1000 },
];
```

- [ ] **Step 4: Write failing tests**

`frontend/src/format.test.ts`:
```ts
import { deliveryDates, formatDayHourUtc, formatGwh, formatHourUtc, formatMw, formatPct, formatUtc } from "./format";

describe("format", () => {
  it("formats MW with thousands separators", () => {
    expect(formatMw(12345.6)).toBe("12,346 MW");
    expect(formatMw(null)).toBe("—");
  });
  it("formats MWh as GWh", () => {
    expect(formatGwh(31080)).toBe("31.1 GWh");
    expect(formatGwh(null)).toBe("—");
  });
  it("formats percentages", () => {
    expect(formatPct(6.25)).toBe("6.3%");
  });
  it("formats UTC timestamps", () => {
    expect(formatUtc("2026-01-02T06:00:00Z")).toBe("2026-01-02 06:00 UTC");
    expect(formatUtc(null)).toBe("—");
    expect(formatHourUtc("2026-01-02T06:00:00Z")).toBe("06:00");
    expect(formatDayHourUtc("2026-01-02T06:00:00Z")).toBe("02 Jan 06:00");
  });
  it("lists delivery dates inclusively", () => {
    const dates = deliveryDates("2026-01-30", "2026-02-01");
    expect(dates).toEqual(["2026-01-30", "2026-01-31", "2026-02-01"]);
  });
});
```

`frontend/src/api.test.ts`:
```ts
import { api } from "./api";

function mockFetch(body: unknown, ok = true, status = 200) {
  const fn = vi.fn().mockResolvedValue({ ok, status, json: async () => body });
  vi.stubGlobal("fetch", fn);
  return fn;
}

afterEach(() => vi.unstubAllGlobals());

describe("api", () => {
  it("builds the decision query string", async () => {
    const fetchMock = mockFetch({ points: [] });
    await api.decision("2026-01-15", 11);
    expect(fetchMock).toHaveBeenCalledWith("/api/decision?delivery_date=2026-01-15&gate_hour=11");
  });
  it("calls meta without a query string", async () => {
    const fetchMock = mockFetch({});
    await api.meta();
    expect(fetchMock).toHaveBeenCalledWith("/api/meta");
  });
  it("surfaces the backend error detail", async () => {
    mockFetch({ detail: "delivery_date must be between 2026-01-02 and 2026-02-01" }, false, 400);
    await expect(api.decision("2026-03-01", 11)).rejects.toThrow("delivery_date must be between");
  });
  it("falls back to the status code when there is no string detail", async () => {
    mockFetch({ detail: [{ msg: "bad" }] }, false, 422);
    await expect(api.accuracy(99)).rejects.toThrow("Request failed: 422");
  });
});
```

- [ ] **Step 5: Run tests to verify they fail**

Run: `cd frontend && npm test`
Expected: FAIL. Vite cannot resolve `./format` and `./api`.

- [ ] **Step 6: Write `frontend/src/format.ts`, `frontend/src/api.ts`, `frontend/src/useAsync.ts`**

`frontend/src/format.ts`:
```ts
const DASH = "—";
const MONTHS = ["Jan", "Feb", "Mar", "Apr", "May", "Jun", "Jul", "Aug", "Sep", "Oct", "Nov", "Dec"];

export const formatMw = (v: number | null | undefined): string =>
  v == null ? DASH : `${Math.round(v).toLocaleString("en-GB")} MW`;

export const formatGwh = (mwh: number | null | undefined): string =>
  mwh == null ? DASH : `${(mwh / 1000).toFixed(1)} GWh`;

export const formatPct = (v: number | null | undefined): string => (v == null ? DASH : `${v.toFixed(1)}%`);

export function formatUtc(iso: string | null | undefined): string {
  if (!iso) return DASH;
  const s = new Date(iso).toISOString();
  return `${s.slice(0, 10)} ${s.slice(11, 16)} UTC`;
}

export const formatHourUtc = (iso: string): string => new Date(iso).toISOString().slice(11, 16);

export function formatDayHourUtc(iso: string): string {
  const d = new Date(iso);
  const day = String(d.getUTCDate()).padStart(2, "0");
  return `${day} ${MONTHS[d.getUTCMonth()]} ${d.toISOString().slice(11, 16)}`;
}

export function deliveryDates(first: string, last: string): string[] {
  const out: string[] = [];
  const d = new Date(`${first}T00:00:00Z`);
  const end = new Date(`${last}T00:00:00Z`);
  while (d <= end) {
    out.push(d.toISOString().slice(0, 10));
    d.setUTCDate(d.getUTCDate() + 1);
  }
  return out;
}
```

`frontend/src/api.ts`:
```ts
import type { AccuracyResponse, DecisionResponse, HorizonRow, Meta } from "./types";

async function getJson<T>(path: string, params: Record<string, string | number> = {}): Promise<T> {
  const qs = new URLSearchParams(Object.entries(params).map(([k, v]) => [k, String(v)])).toString();
  const res = await fetch(qs ? `${path}?${qs}` : path);
  const body = await res.json().catch(() => ({}));
  if (!res.ok) {
    throw new Error(typeof body.detail === "string" ? body.detail : `Request failed: ${res.status}`);
  }
  return body as T;
}

export const api = {
  meta: () => getJson<Meta>("/api/meta"),
  decision: (deliveryDate: string, gateHour: number) =>
    getJson<DecisionResponse>("/api/decision", { delivery_date: deliveryDate, gate_hour: gateHour }),
  accuracy: (horizon: number) => getJson<AccuracyResponse>("/api/accuracy", { horizon }),
  byHorizon: () => getJson<HorizonRow[]>("/api/accuracy/by-horizon"),
};
```

`frontend/src/useAsync.ts`:
```ts
import { type DependencyList, useEffect, useState } from "react";

export function useAsync<T>(load: () => Promise<T>, deps: DependencyList) {
  const [data, setData] = useState<T | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    let cancelled = false;
    setLoading(true);
    setError(null);
    load()
      .then((d) => !cancelled && setData(d))
      .catch((e: Error) => !cancelled && setError(e.message))
      .finally(() => !cancelled && setLoading(false));
    return () => {
      cancelled = true;
    };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, deps);

  return { data, error, loading };
}
```

- [ ] **Step 7: Run tests to verify they pass, then build**

Run: `cd frontend && npm test`
Expected: 9 passed.

Run: `cd frontend && npm run build`
Expected: `dist/` is produced with no TypeScript errors.

- [ ] **Step 8: Commit**

```bash
git add frontend/package.json frontend/package-lock.json frontend/tsconfig.json frontend/vite.config.ts frontend/index.html frontend/src
git commit -m "feat(frontend): scaffold Vite React app with typed API client and formatters"
```

---

### Task 7: Day-ahead decision view and app shell

**Files:**
- Create: `frontend/src/components/MetricCards.tsx`, `frontend/src/components/DecisionView.tsx`
- Create (stub until Task 8): `frontend/src/components/AccuracyView.tsx`
- Modify: `frontend/src/App.tsx` (replace whole file)
- Test: `frontend/src/components/DecisionView.test.tsx`

**Interfaces:**
- Consumes: `api`, `useAsync`, formatters, `deliveryDates`, types, fixtures (Task 6).
- Produces: `Card` type `{ label: string; value: string; hint?: string }`, `MetricCards({ cards }: { cards: Card[] })`, `DecisionView({ meta }: { meta: Meta })`, `AccuracyView({ meta }: { meta: Meta })` (stub here, full in Task 8), default export `App`.

- [ ] **Step 1: Write failing test `frontend/src/components/DecisionView.test.tsx`**

```tsx
import { fireEvent, render, screen } from "@testing-library/react";
import { api } from "../api";
import { decisionFixture, metaFixture } from "../test/fixtures";
import { DecisionView } from "./DecisionView";

vi.mock("../api", () => ({
  api: { meta: vi.fn(), decision: vi.fn(), accuracy: vi.fn(), byHorizon: vi.fn() },
}));

beforeEach(() => {
  vi.mocked(api.decision).mockResolvedValue(decisionFixture);
});

describe("DecisionView", () => {
  it("loads the first delivery day at the default gate closure", async () => {
    render(<DecisionView meta={metaFixture} />);
    expect(await screen.findByText("Shortfall at risk (P10)")).toBeInTheDocument();
    expect(api.decision).toHaveBeenCalledWith("2026-01-02", 11);
    // (1000-800) + (1200-900) = 500 MWh
    expect(screen.getByText("0.5 GWh")).toBeInTheDocument();
    expect(screen.getByText("2026-01-01 09:30 UTC")).toBeInTheDocument();
  });

  it("refetches when the delivery day changes", async () => {
    render(<DecisionView meta={metaFixture} />);
    await screen.findByText("Shortfall at risk (P10)");
    fireEvent.change(screen.getByLabelText("Delivery day"), { target: { value: "2026-01-15" } });
    expect(api.decision).toHaveBeenLastCalledWith("2026-01-15", 11);
  });

  it("shows backend errors", async () => {
    vi.mocked(api.decision).mockRejectedValue(new Error("boom"));
    render(<DecisionView meta={metaFixture} />);
    expect(await screen.findByText("boom")).toBeInTheDocument();
  });
});
```

- [ ] **Step 2: Run test to verify it fails**

Run: `cd frontend && npx vitest run src/components/DecisionView.test.tsx`
Expected: FAIL. Vite cannot resolve `./DecisionView`.

- [ ] **Step 3: Write `frontend/src/components/MetricCards.tsx`**

```tsx
export interface Card {
  label: string;
  value: string;
  hint?: string;
}

export function MetricCards({ cards }: { cards: Card[] }) {
  return (
    <div className="cards">
      {cards.map((c) => (
        <div className="card" key={c.label}>
          <div className="card-label">{c.label}</div>
          <div className="card-value">{c.value}</div>
          {c.hint && <div className="card-hint">{c.hint}</div>}
        </div>
      ))}
    </div>
  );
}
```

- [ ] **Step 4: Write `frontend/src/components/DecisionView.tsx`**

```tsx
import { useState } from "react";
import { Area, CartesianGrid, ComposedChart, Legend, Line, ResponsiveContainer, Tooltip, XAxis, YAxis } from "recharts";
import { api } from "../api";
import { deliveryDates, formatGwh, formatHourUtc, formatMw, formatUtc } from "../format";
import type { DecisionResponse, Meta } from "../types";
import { useAsync } from "../useAsync";
import { type Card, MetricCards } from "./MetricCards";

const HOURS = Array.from({ length: 24 }, (_, h) => h);

function shortfallAtRiskMwh(d: DecisionResponse): number | null {
  // Energy to cover if wind lands at the low (P10) bound; points are hourly so summed MW are MWh.
  if (d.points.length === 0 || d.points.some((p) => p.low_mw == null)) return null;
  return d.points.reduce((sum, p) => sum + (p.forecast_mw - (p.low_mw as number)), 0);
}

function decisionCards(d: DecisionResponse): Card[] {
  const atRisk = shortfallAtRiskMwh(d);
  return [
    { label: "Forecast wind energy", value: formatGwh(d.forecast_energy_mwh), hint: `delivery day ${d.delivery_date}` },
    { label: "Latest forecast before gate", value: formatUtc(d.forecast_published_at), hint: `gate closure ${formatUtc(d.gate_closure)}` },
    {
      label: "Shortfall at risk (P10)",
      value: formatGwh(atRisk),
      hint: atRisk == null ? "not enough history for a range yet" : `from ${d.band_samples} recent forecast/actual pairs`,
    },
    {
      label: "Actual wind energy",
      value: formatGwh(d.actual_energy_mwh),
      hint: d.metrics.n > 0 ? `hourly MAE ${formatMw(d.metrics.mae_mw)}` : "outturn not yet available",
    },
  ];
}

const mwOrRange = (v: unknown): string =>
  Array.isArray(v) ? `${formatMw(v[0] as number)} – ${formatMw(v[1] as number)}` : formatMw(v as number);

export function DecisionView({ meta }: { meta: Meta }) {
  const [deliveryDate, setDeliveryDate] = useState(meta.first_delivery_date);
  const [gateHour, setGateHour] = useState(meta.default_gate_hour_utc);
  const decision = useAsync(() => api.decision(deliveryDate, gateHour), [deliveryDate, gateHour]);
  const d = decision.data;

  const rows = d?.points.map((p) => ({
    time: formatHourUtc(p.start_time),
    forecast: p.forecast_mw,
    actual: p.actual_mw,
    band: p.low_mw != null && p.high_mw != null ? [p.low_mw, p.high_mw] : null,
  }));

  return (
    <section>
      <div className="controls">
        <label>
          Delivery day{" "}
          <select value={deliveryDate} onChange={(e) => setDeliveryDate(e.target.value)}>
            {deliveryDates(meta.first_delivery_date, meta.last_delivery_date).map((day) => (
              <option key={day} value={day}>{day}</option>
            ))}
          </select>
        </label>
        <label>
          Gate closure on D-1{" "}
          <select value={gateHour} onChange={(e) => setGateHour(Number(e.target.value))}>
            {HOURS.map((h) => (
              <option key={h} value={h}>{`${String(h).padStart(2, "0")}:00 UTC`}</option>
            ))}
          </select>
        </label>
        {decision.loading && <span className="muted">Loading…</span>}
      </div>
      {decision.error && <div className="error">{decision.error}</div>}
      {d && (
        <>
          <MetricCards cards={decisionCards(d)} />
          <div className="panel">
            <h2>Wind forecast available at gate closure vs outturn</h2>
            <p>
              Shaded band: likely range (P10–P90) based on errors from the last 14 days at the same lead time,
              using only outturn published before gate closure.
            </p>
            <ResponsiveContainer width="100%" height={360}>
              <ComposedChart data={rows}>
                <CartesianGrid strokeDasharray="3 3" stroke="#e2e8f0" />
                <XAxis dataKey="time" />
                <YAxis tickFormatter={(v: number) => `${(v / 1000).toFixed(0)} GW`} />
                <Tooltip formatter={mwOrRange} />
                <Legend />
                <Area dataKey="band" name="Likely range (P10–P90)" fill="#93c5fd" stroke="none" fillOpacity={0.4} />
                <Line dataKey="forecast" name="Forecast" stroke="#2563eb" strokeWidth={2} dot={false} />
                <Line dataKey="actual" name="Actual" stroke="#16a34a" strokeWidth={2} dot={false} />
              </ComposedChart>
            </ResponsiveContainer>
          </div>
        </>
      )}
    </section>
  );
}
```

- [ ] **Step 5: Write the AccuracyView stub and App shell**

`frontend/src/components/AccuracyView.tsx` (stub, replaced in Task 8):
```tsx
import type { Meta } from "../types";

export function AccuracyView({ meta }: { meta: Meta }) {
  return <section className="muted">Accuracy analysis for horizons up to {meta.max_horizon_hours} h.</section>;
}
```

`frontend/src/App.tsx`:
```tsx
import { useState } from "react";
import { api } from "./api";
import { AccuracyView } from "./components/AccuracyView";
import { DecisionView } from "./components/DecisionView";
import { useAsync } from "./useAsync";

type Tab = "decision" | "accuracy";

const TABS: { id: Tab; label: string }[] = [
  { id: "decision", label: "Day-ahead decision" },
  { id: "accuracy", label: "Forecast accuracy" },
];

export default function App() {
  const [tab, setTab] = useState<Tab>("decision");
  const meta = useAsync(() => api.meta(), []);

  return (
    <div className="app">
      <header className="header">
        <div>
          <h1>GridBrick · Wind Forecast Monitor</h1>
          <p className="subtitle">GB national wind generation · day-ahead buying decisions for January 2026</p>
        </div>
        <nav className="tabs">
          {TABS.map((t) => (
            <button key={t.id} aria-pressed={tab === t.id} onClick={() => setTab(t.id)}>
              {t.label}
            </button>
          ))}
        </nav>
      </header>
      <main>
        {meta.error && <div className="error">{meta.error}</div>}
        {meta.data && (tab === "decision" ? <DecisionView meta={meta.data} /> : <AccuracyView meta={meta.data} />)}
      </main>
      <footer>
        Data: Elexon BMRS — FUELHH (outturn, fuelType WIND) and WINDFOR (forecast). All times UTC (= UK time in
        January). {meta.data && `${meta.data.forecast_runs} forecast runs loaded from ${meta.data.data_source}.`}
      </footer>
    </div>
  );
}
```

- [ ] **Step 6: Run tests to verify they pass, then build**

Run: `cd frontend && npm test`
Expected: all pass (12 tests). Recharts may log size warnings under jsdom; these are harmless.

Run: `cd frontend && npm run build` → succeeds.

- [ ] **Step 7: Manual check in the browser**

Run the backend: `cd backend && uvicorn app.main:app --port 8000`. Run the frontend: `cd frontend && npm run dev`. Open `http://localhost:5173`.
Expected: the decision tab shows 4 cards plus a chart with a forecast line, an actual line and a shaded band. Changing the delivery day or gate hour updates both.

- [ ] **Step 8: Commit**

```bash
git add frontend/src
git commit -m "feat(frontend): add day-ahead decision view and app shell"
```

---

### Task 8: Forecast accuracy view

**Files:**
- Modify: `frontend/src/components/AccuracyView.tsx` (replace whole file)
- Test: `frontend/src/components/AccuracyView.test.tsx`, `frontend/src/App.test.tsx`

**Interfaces:**
- Consumes: `api.accuracy`, `api.byHorizon`, `MetricCards`, formatters, fixtures.
- Produces: `AccuracyView({ meta }: { meta: Meta })`

- [ ] **Step 1: Write failing tests**

`frontend/src/components/AccuracyView.test.tsx`:
```tsx
import { fireEvent, render, screen } from "@testing-library/react";
import { api } from "../api";
import { accuracyFixture, horizonFixture, metaFixture } from "../test/fixtures";
import { AccuracyView } from "./AccuracyView";

vi.mock("../api", () => ({
  api: { meta: vi.fn(), decision: vi.fn(), accuracy: vi.fn(), byHorizon: vi.fn() },
}));

beforeEach(() => {
  vi.mocked(api.accuracy).mockResolvedValue(accuracyFixture);
  vi.mocked(api.byHorizon).mockResolvedValue(horizonFixture);
});

describe("AccuracyView", () => {
  it("shows headline metrics for the default 24 h horizon", async () => {
    render(<AccuracyView meta={metaFixture} />);
    expect(await screen.findByText("Mean absolute error")).toBeInTheDocument();
    expect(api.accuracy).toHaveBeenCalledWith(24);
    expect(screen.getByText("512 MW")).toBeInTheDocument();
    expect(screen.getByText("6.2%")).toBeInTheDocument();
    expect(await screen.findByText("How error grows with lead time")).toBeInTheDocument();
  });

  it("refetches when the horizon slider moves", async () => {
    render(<AccuracyView meta={metaFixture} />);
    await screen.findByText("Mean absolute error");
    fireEvent.change(screen.getByLabelText(/Forecast horizon/), { target: { value: "6" } });
    expect(api.accuracy).toHaveBeenLastCalledWith(6);
  });
});
```

`frontend/src/App.test.tsx`:
```tsx
import { fireEvent, render, screen } from "@testing-library/react";
import App from "./App";
import { api } from "./api";
import { accuracyFixture, decisionFixture, horizonFixture, metaFixture } from "./test/fixtures";

vi.mock("./api", () => ({
  api: { meta: vi.fn(), decision: vi.fn(), accuracy: vi.fn(), byHorizon: vi.fn() },
}));

beforeEach(() => {
  vi.mocked(api.meta).mockResolvedValue(metaFixture);
  vi.mocked(api.decision).mockResolvedValue(decisionFixture);
  vi.mocked(api.accuracy).mockResolvedValue(accuracyFixture);
  vi.mocked(api.byHorizon).mockResolvedValue(horizonFixture);
});

it("switches between the decision and accuracy tabs", async () => {
  render(<App />);
  expect(await screen.findByText("Shortfall at risk (P10)")).toBeInTheDocument();
  fireEvent.click(screen.getByRole("button", { name: "Forecast accuracy" }));
  expect(await screen.findByText("Mean absolute error")).toBeInTheDocument();
});
```

- [ ] **Step 2: Run tests to verify they fail**

Run: `cd frontend && npm test`
Expected: FAIL. `AccuracyView` tests cannot find "Mean absolute error" (the stub renders none). The App test also fails on the accuracy tab.

- [ ] **Step 3: Write `frontend/src/components/AccuracyView.tsx`**

```tsx
import { useState } from "react";
import {
  Area,
  Bar,
  BarChart,
  CartesianGrid,
  ComposedChart,
  Legend,
  Line,
  LineChart,
  ResponsiveContainer,
  Tooltip,
  XAxis,
  YAxis,
} from "recharts";
import { api } from "../api";
import { formatDayHourUtc, formatMw, formatPct } from "../format";
import type { Meta } from "../types";
import { useAsync } from "../useAsync";
import { MetricCards } from "./MetricCards";

const gw = (v: number) => `${(v / 1000).toFixed(0)} GW`;
const mwOrRange = (v: unknown): string =>
  Array.isArray(v) ? `${formatMw(v[0] as number)} – ${formatMw(v[1] as number)}` : formatMw(v as number);

export function AccuracyView({ meta }: { meta: Meta }) {
  const [horizon, setHorizon] = useState(24);
  const accuracy = useAsync(() => api.accuracy(horizon), [horizon]);
  const profile = useAsync(() => api.byHorizon(), []);
  const a = accuracy.data;
  const m = a?.metrics;

  const series = a?.points.map((p) => ({ time: formatDayHourUtc(p.start_time), forecast: p.forecast_mw, actual: p.actual_mw }));
  const bins = a?.histogram.map((b) => ({ label: `${(b.bin_start_mw / 1000).toFixed(2)} GW`, count: b.count }));
  const byHorizon = profile.data?.map((r) => ({
    horizon: r.horizon_hours,
    mae: r.metrics.mae_mw,
    band: r.p10_error_mw != null && r.p90_error_mw != null ? [r.p10_error_mw, r.p90_error_mw] : null,
  }));

  return (
    <section>
      <div className="controls">
        <label htmlFor="horizon">
          Forecast horizon: <strong>{horizon} h</strong> ahead
        </label>
        <input
          id="horizon"
          type="range"
          min={0}
          max={meta.max_horizon_hours}
          step={1}
          value={horizon}
          onChange={(e) => setHorizon(Number(e.target.value))}
        />
        <span className="muted">For every hour, uses the latest forecast published at least {horizon} h earlier.</span>
      </div>
      {accuracy.error && <div className="error">{accuracy.error}</div>}
      {m && (
        <MetricCards
          cards={[
            { label: "Mean absolute error", value: formatMw(m.mae_mw), hint: `${m.n} hourly samples` },
            { label: "RMSE", value: formatMw(m.rmse_mw), hint: "penalises large misses" },
            { label: "Bias", value: formatMw(m.bias_mw), hint: "positive = wind over-forecast" },
            { label: "WAPE", value: formatPct(m.wape_pct), hint: "absolute error as % of actual energy" },
            { label: "P90 absolute error", value: formatMw(m.p90_abs_mw), hint: "9 in 10 hours miss by less" },
          ]}
        />
      )}
      {a && (
        <div className="panel">
          <h2>Actual vs forecast — January 2026 delivery</h2>
          <p>Forecast shown is what was available {horizon} h before each hour.</p>
          <ResponsiveContainer width="100%" height={320}>
            <LineChart data={series}>
              <CartesianGrid strokeDasharray="3 3" stroke="#e2e8f0" />
              <XAxis dataKey="time" minTickGap={60} />
              <YAxis tickFormatter={gw} />
              <Tooltip formatter={mwOrRange} />
              <Legend />
              <Line dataKey="actual" name="Actual" stroke="#16a34a" dot={false} strokeWidth={1.5} />
              <Line dataKey="forecast" name="Forecast" stroke="#2563eb" dot={false} strokeWidth={1.5} />
            </LineChart>
          </ResponsiveContainer>
        </div>
      )}
      <div className="grid-2">
        {a && (
          <div className="panel">
            <h2>Error distribution</h2>
            <p>Forecast − actual, hourly. Right of zero means wind came in lower than forecast.</p>
            <ResponsiveContainer width="100%" height={260}>
              <BarChart data={bins}>
                <CartesianGrid strokeDasharray="3 3" stroke="#e2e8f0" />
                <XAxis dataKey="label" minTickGap={20} />
                <YAxis allowDecimals={false} />
                <Tooltip />
                <Bar dataKey="count" name="Hours" fill="#6366f1" />
              </BarChart>
            </ResponsiveContainer>
          </div>
        )}
        {byHorizon && (
          <div className="panel">
            <h2>How error grows with lead time</h2>
            <p>MAE and P10–P90 signed error by forecast horizon (hours before delivery).</p>
            <ResponsiveContainer width="100%" height={260}>
              <ComposedChart data={byHorizon}>
                <CartesianGrid strokeDasharray="3 3" stroke="#e2e8f0" />
                <XAxis dataKey="horizon" unit=" h" />
                <YAxis tickFormatter={gw} />
                <Tooltip formatter={mwOrRange} />
                <Legend />
                <Area dataKey="band" name="P10–P90 error" fill="#fcd34d" stroke="none" fillOpacity={0.5} />
                <Line dataKey="mae" name="MAE" stroke="#dc2626" strokeWidth={2} />
              </ComposedChart>
            </ResponsiveContainer>
          </div>
        )}
      </div>
    </section>
  );
}
```

- [ ] **Step 4: Run tests to verify they pass, then build**

Run: `cd frontend && npm test`
Expected: all pass (15 tests).

Run: `cd frontend && npm run build` → succeeds.

- [ ] **Step 5: Manual check in the browser**

With the backend and `npm run dev` running, open the Forecast accuracy tab.
Expected: 5 cards. The time series covers all of January. Dragging the slider updates the cards and charts within about 1 s. The horizon chart's MAE rises with lead time.

- [ ] **Step 6: Commit**

```bash
git add frontend/src
git commit -m "feat(frontend): add forecast accuracy view with horizon analysis"
```

---

### Task 9: Docker image and Heroku container config

**Files:**
- Create: `Dockerfile`, `.dockerignore`, `docker-compose.yml`, `heroku.yml`

**Interfaces:**
- Consumes: `backend/app/main.py:app`, which serves `backend/static` when present (`STATIC_DIR`); `frontend` `npm run build` → `dist/`.
- Produces: one image that listens on `$PORT` (default 8000), serving `/api/*` and the SPA at `/`.

- [ ] **Step 1: Write the files**

`Dockerfile`:
```dockerfile
FROM node:20-alpine AS web
WORKDIR /web
COPY frontend/package.json frontend/package-lock.json ./
RUN npm ci
COPY frontend/ ./
RUN npm run build

FROM python:3.12-slim
WORKDIR /app
COPY backend/requirements.txt ./
RUN pip install --no-cache-dir -r requirements.txt
COPY backend/app ./app
COPY backend/data ./data
COPY --from=web /web/dist ./static
ENV PORT=8000
EXPOSE 8000
CMD ["sh", "-c", "uvicorn app.main:app --host 0.0.0.0 --port ${PORT}"]
```

`.dockerignore`:
```
.git
.claude
**/__pycache__
**/.pytest_cache
backend/.venv
backend/static
frontend/node_modules
frontend/dist
docs
```

`docker-compose.yml`:
```yaml
services:
  web:
    build: .
    ports:
      - "8000:8000"
```

`heroku.yml`:
```yaml
build:
  docker:
    web: Dockerfile
```

- [ ] **Step 2: Build and run the container**

Run: `docker compose up --build -d`
Expected: the build succeeds and the container starts.

Run:
```bash
curl -s localhost:8000/api/health
curl -s localhost:8000/api/meta
curl -s localhost:8000/ | grep -o "<title>.*</title>"
```
Expected: `{"status":"ok"}`, then meta with `"data_source":"snapshot"`, then `<title>GridBrick · Wind Forecast Monitor</title>`.

Open `http://localhost:8000` and click through both tabs. Then run `docker compose down`.

- [ ] **Step 3: Commit**

```bash
git add Dockerfile .dockerignore docker-compose.yml heroku.yml
git commit -m "build: add multi-stage Docker image and Heroku container config"
```

---

### Task 10: README, demo script, publish and deploy

**Files:**
- Create: `README.md`, `docs/demo-script.md`

**Interfaces:**
- Consumes: everything above.
- Produces: a public GitHub repo with a random name, a live Heroku URL in the README, and a video outline.

- [ ] **Step 1: Write `README.md`**

````markdown
# GridBrick · Wind Forecast Monitor

A pilot web app for a UK utility's day-ahead power buying team. It answers two questions for January 2026 delivery:

1. **What wind forecast was available when we had to buy?** For each delivery day it shows the latest GB national wind forecast published before day-ahead gate closure (default 11:00 UTC on D-1). Around it sits an empirical P10–P90 range, plus the "shortfall at risk": the energy to cover if wind lands at its P10.
2. **How much can we trust it?** It reports MAE, RMSE, bias, WAPE and P90 absolute error for any forecast lead time from 0 to 48 h, along with the error distribution and how error grows with lead time.

**Live app:** <HEROKU_URL>

## Data

- Actuals: Elexon BMRS `FUELHH`, `fuelType = WIND`, half-hourly `generation` (MW).
- Forecasts: Elexon BMRS `WINDFOR`, hourly `generation` (MW) per `publishTime` run.
- Window: forecasts published 2025-12-23 → 2026-02-01 12:00 UTC and actuals 2025-12-25 → 2026-02-02. That covers purchase decisions made during January 2026 (delivery 2026-01-02 → 2026-02-01) plus some lead-in history for the error bands.
- Because January 2026 is history, a snapshot is committed in `backend/data/`. Refresh it with `python -m scripts.snapshot`.

## Method

- **Horizon h:** for each target hour, take the latest forecast published at least h hours earlier.
- **Error:** `forecast − actual`. Positive means wind was over-forecast, so the buyer is short.
- **Decision band:** P10/P90 of signed errors from the previous 14 days at the gate-closure lead time. It uses only outturn published before gate closure, so there is no look-ahead. The band is hidden when there are fewer than 48 samples.

## Files and directories

| Path | Purpose |
|---|---|
| `backend/app/config.py` | Constants: Elexon URL, data windows, gate closure, paths |
| `backend/app/elexon.py` | Fetches FUELHH/WINDFOR and normalises them into DataFrames |
| `backend/app/store.py` | Dataset type; snapshot save/load; cached loader with live fallback |
| `backend/app/analytics.py` | Pure analysis: horizon selection, metrics, histogram, decision view, error bands |
| `backend/app/schemas.py` | Pydantic API response models |
| `backend/app/main.py` | FastAPI routes (`/api/*`) and static frontend serving |
| `backend/data/` | Committed January 2026 snapshot (gzipped CSV) |
| `backend/scripts/snapshot.py` | Refreshes the snapshot from Elexon |
| `backend/tests/` | pytest suite with a synthetic dataset where error = 10 MW × horizon |
| `frontend/src/App.tsx` | App shell and tabs |
| `frontend/src/components/` | `DecisionView`, `AccuracyView`, `MetricCards` (+ tests) |
| `frontend/src/api.ts`, `types.ts` | Typed API client mirroring the backend schemas |
| `frontend/src/format.ts`, `useAsync.ts` | Formatting helpers and data-loading hook |
| `Dockerfile`, `docker-compose.yml`, `heroku.yml` | Container build/run and Heroku deployment |
| `docs/demo-script.md` | Outline for the demo video |

## Running

With Docker (recommended):

```bash
docker compose up --build
```

Then open http://localhost:8000.

Local development:

```bash
cd backend && python -m venv .venv && source .venv/Scripts/activate  # .venv/bin/activate on macOS/Linux
pip install -r requirements-dev.txt && uvicorn app.main:app --reload --port 8000
```

```bash
cd frontend && npm install && npm run dev   # http://localhost:5173, proxies /api to :8000
```

Tests:

```bash
cd backend && pytest
```

```bash
cd frontend && npm test
```

## Deployment

Deployed to Heroku using the container stack (`heroku.yml` builds the root `Dockerfile`):

```bash
heroku create <app-name> --stack container
git push heroku main
```

## AI tools

This project was built with the help of AI tools: Claude Code (Anthropic) assisted with planning, code generation and tests. All design decisions, the analysis method and the final code were reviewed by the author.
````

- [ ] **Step 2: Write `docs/demo-script.md`**

```markdown
# Demo video script (≤ 10 min)

## Part 1 — Client pitch (≤ 5 min)
1. (0:30) Problem: day-ahead bids are locked in at 11:00 on D-1, and wind is the biggest swing factor in what still needs buying.
2. (1:30) Day-ahead decision tab: pick a January day and show the forecast that was actually available at gate closure, the likely range, and "shortfall at risk" in GWh. Switch to a stormy day and a calm day to contrast them.
3. (1:30) Forecast accuracy tab: headline MAE/WAPE at 24 h, and bias (are forecasts systematically optimistic?). Drag the horizon slider to show error growing with lead time.
4. (1:00) Value: size hedges from the P10 shortfall rather than a single number. Next steps: more fuel types, live data feed, alerts.

## Part 2 — Tech lead review (≤ 5 min)
1. (1:00) Architecture: Elexon → snapshot/live store → pure pandas analytics → FastAPI → React. One Docker image, deployed on Heroku.
2. (1:30) Analysis design: horizon definition, sign convention, a no-look-ahead error band, and why WINDFOR is evaluated hourly.
3. (1:30) Code walkthrough: `analytics.py` (pure, unit-tested on a synthetic dataset with known error), `main.py` (thin HTTP layer, dependency-injected dataset), and the frontend's typed client.
4. (1:00) Practices: TDD, pinned dependencies, committed reproducible snapshot, AI-assisted development disclosed. Trade-offs and what I would do next (caching, CI, quantile-calibration checks).
```

- [ ] **Step 3: Run the full test suites one final time**

Run: `cd backend && pytest` → all pass. Run: `cd frontend && npm test && npm run build` → all pass, and the build succeeds.

- [ ] **Step 4: Commit**

```bash
git add README.md docs/demo-script.md
git commit -m "docs: add README and demo script"
```

- [ ] **Step 5: Publish to GitHub (confirm with the user before running; this creates a public repo)**

```bash
gh repo create <random-name> --public --source . --push
```
Use a random anonymous name, e.g. `qzv7k`.

- [ ] **Step 6: Deploy to Heroku (confirm with the user first; this needs their Heroku account, and an Eco dyno costs money)**

```bash
heroku login
heroku create <random-name> --stack container
git push heroku main
heroku open
```
Expected: the app loads at `https://<random-name>-xxxx.herokuapp.com` and both tabs work. Check it in an incognito window.

- [ ] **Step 7: Put the live URL in the README and push**

Replace `<HEROKU_URL>` in `README.md` with the real URL, then:
```bash
git add README.md
git commit -m "docs: add live app link"
git push origin main && git push heroku main
```
