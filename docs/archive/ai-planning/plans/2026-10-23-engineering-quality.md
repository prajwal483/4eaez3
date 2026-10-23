# Engineering Quality Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Close the gaps between the GridBrick repo and what the hiring team looks for (strong React, an API that ages well, rigour, engineering discipline, ownership), and rewrite the README and docs so they read as written by an engineer, not generated.

**Architecture:** No new features. Five kinds of change:
- **Discipline:** linting, CI, a PR-based workflow.
- **API:** version the API (`/api/v1`), add one error envelope, FastAPI dependencies and cache headers.
- **Observability:** structured logs, request ids, timing.
- **Contract:** generate the frontend types from the OpenAPI schema and fail CI on drift.
- **React:** URL-synced state, a query cache with request cancellation, a debounced slider, memoised charts, keyboard support and an error boundary.

Then edge-case tests and the docs rewrite with decision records.

**Tech Stack:** FastAPI 0.115, pydantic 2, pandas, pytest + pytest-cov, ruff; React 18, TypeScript 5.6, Vite 5, Vitest, ESLint 9 (typescript-eslint), openapi-typescript 7; GitHub Actions; Vercel.

## Audit (why each task exists)

| Hiring criterion | What the repo shows today | Gap | Task |
|---|---|---|---|
| Engineering discipline | Conventional commits, Docker | No CI, no linters, no PRs or review trail, no contributor docs | 1, 7 |
| API that ages well | Typed pydantic responses, thin routes | Unversioned paths; two error shapes (`detail` string vs 422 list); dataset passed by closure, not `Depends`; no cache headers; OpenAPI undocumented | 2 |
| Observability | — | No logging, no request ids, no timing | 3 |
| Rigour | 71 tests, 97% backend coverage | Frontend types are hand-copied from the backend (drift risk); no coverage gate; some edge cases untested (day with no forecast, gate 00:00/23:59, missing snapshot, upstream 503) | 4, 6 |
| Strong React | Clean components, custom charts | No URL state (links can't be shared, refresh loses the view); every slider tick refetches; no request cancellation or caching; 744-point chart re-renders on unrelated state; no error boundary | 5, 6 |
| Ownership instinct | The README mentions gate time and bias caveats | Decisions are buried in prose; no record of what was ambiguous and how I resolved it | 7 |
| README "humanised" | Accurate but reads like a spec: dense bullets, no voice, no "why", a long table | Rewrite in first person with decisions, trade-offs and next steps; move AI planning docs to an archive | 7 |

Lint dry-run on the current code (run 2026-10-23):
- **ESLint** (typescript-eslint plus react-hooks): 0 problems.
- **Ruff** (E, F, I, B, UP, SIM at 120 columns): 6 findings.
  - `B008` on `Query(...)` in `app/main.py`.
  - Five `E501` long lines in `tests/test_elexon.py`.

## Global Constraints

- **No feature or analysis changes.** The only behaviour change is that a day with no forecast reports `forecast_energy_mwh: null` instead of `0.0` (Task 6).
- **Versions:**
  - Backend: ruff `0.8.4`, pytest-cov `6.0.0`.
  - Frontend: eslint `^9`, typescript-eslint `^8`, eslint-plugin-react-hooks `^5`, globals `^15`, openapi-typescript `^7`.
  - CI: Python 3.12, Node 20.
- **Workflow for every task:**
  1. `git checkout -b improve/<n>-<slug>` from an up-to-date `main`.
  2. Commit (conventional commits, ending with the co-author trailer).
  3. `git push -u origin HEAD`, then `gh pr create --fill`.
  4. Wait for CI to pass.
  5. `gh pr merge --merge --delete-branch`.
  6. `git checkout main && git pull`.
  7. If app code changed, run `npx vercel deploy --prod --yes` from the repo root and check https://4eaez3.vercel.app.
- **The old `/api/*` paths must keep working** (deprecated alias) until the frontend no longer uses them.
- **README must still contain** the challenge's required items: files and directories, how to start, the live link, and the AI-tools disclosure.
- **Never commit** `.env*`, `.vercel/`, or `backend/backend.zip` (the user's own untracked file; leave it alone).
- Commands run from the repo root unless a step says `cd`.

## File structure (what this plan adds or changes)

```
.github/workflows/ci.yml                 CI: lint, types, tests + coverage, API contract, Docker smoke test
.github/pull_request_template.md         PR checklist
CONTRIBUTING.md                          How to work on the repo
README.md                                Rewritten
docs/decisions/0001-…0007-*.md           Decision records
docs/archive/ai-planning/                Old docs/superpowers plans and specs, moved
backend/pyproject.toml                   Ruff config
backend/app/deps.py                      FastAPI dependencies (dataset)
backend/app/errors.py                    Error envelope + handlers
backend/app/routes.py                    /api/v1 router
backend/app/observability.py             JSON logs, request id, timing, 500 handler
backend/app/main.py                      App factory wiring
backend/app/schemas.py                   + ErrorBody, ErrorResponse, Health
backend/scripts/export_openapi.py        Writes frontend/openapi.json
frontend/eslint.config.js                ESLint flat config
frontend/openapi.json, src/schema.d.ts   Generated API contract
frontend/src/types.ts                    Re-exports generated types
frontend/src/api.ts                      /api/v1, ApiError with request id, AbortSignal
frontend/src/data/useQuery.ts            Cache + cancellation (replaces useAsync.ts)
frontend/src/state/viewState.ts          URL <-> view state (pure)
frontend/src/state/useViewState.ts       Hook syncing view state to the URL
frontend/src/hooks/useDebouncedValue.ts  Debounce
frontend/src/hooks/useArrowKeys.ts       ←/→ day stepping
frontend/src/components/feedback/ErrorBoundary.tsx
```

---

### Task 1: Linters and CI

**Files:**
- Create: `backend/pyproject.toml`, `frontend/eslint.config.js`, `.github/workflows/ci.yml`
- Modify: `backend/requirements-dev.txt`, `frontend/package.json` (scripts and devDependencies via npm)
- Reformat: all backend Python via `ruff format`

**Interfaces:**
- Produces: `npm run lint`, `npm run typecheck`; `ruff check` and `ruff format --check` clean; CI workflow `CI` with jobs `backend`, `frontend`, `docker`.

- [ ] **Step 1: Branch**

```bash
git checkout main && git pull && git checkout -b improve/1-lint-and-ci
```

- [ ] **Step 2: Add backend tooling**

**`backend/requirements-dev.txt`** (replace)
```
-r requirements.txt
pytest==8.3.4
pytest-cov==6.0.0
ruff==0.8.4
```

**`backend/pyproject.toml`** (create)
```toml
[tool.ruff]
line-length = 120
target-version = "py312"

[tool.ruff.lint]
select = ["E", "F", "I", "B", "UP", "SIM"]

[tool.ruff.lint.flake8-bugbear]
# FastAPI declares parameters through these calls in default values; that is the framework's design.
extend-immutable-calls = ["fastapi.Query", "fastapi.Depends"]
```

Run:
```bash
cd backend && .venv/Scripts/python -m pip install -r requirements-dev.txt && .venv/Scripts/python -m ruff format . ../api && .venv/Scripts/python -m ruff check . ../api && .venv/Scripts/python -m pytest -q --cov=app --cov-fail-under=95
```
Expected: `ruff format` rewrites some files (it wraps the long dict lines in `tests/test_elexon.py`). `ruff check` prints `All checks passed!`. Tests: 33 passed, coverage ≥ 95%.

- [ ] **Step 3: Add frontend tooling**

```bash
cd frontend && npm install -D eslint@^9 @eslint/js@^9 typescript-eslint@^8 eslint-plugin-react-hooks@^5 globals@^15 && npm pkg set scripts.lint="eslint ." scripts.typecheck="tsc --noEmit"
```

**`frontend/eslint.config.js`** (create)
```js
import js from "@eslint/js";
import reactHooks from "eslint-plugin-react-hooks";
import globals from "globals";
import tseslint from "typescript-eslint";

export default tseslint.config(
  { ignores: ["dist"] },
  {
    extends: [js.configs.recommended, ...tseslint.configs.recommended],
    files: ["**/*.{ts,tsx}"],
    languageOptions: { ecmaVersion: 2022, globals: globals.browser },
    plugins: { "react-hooks": reactHooks },
    rules: { ...reactHooks.configs.recommended.rules },
  },
);
```

Run: `cd frontend && npm run lint && npm run typecheck && npm test && npm run build`
Expected: lint prints nothing (0 problems), typecheck passes, 38 tests pass, build succeeds.

- [ ] **Step 4: Add the CI workflow**

**`.github/workflows/ci.yml`** (create)
```yaml
name: CI

on:
  push:
    branches: [main]
  pull_request:

concurrency:
  group: ci-${{ github.ref }}
  cancel-in-progress: true

jobs:
  backend:
    runs-on: ubuntu-latest
    defaults:
      run:
        working-directory: backend
    steps:
      - uses: actions/checkout@v4
      - uses: actions/setup-python@v5
        with:
          python-version: "3.12"
          cache: pip
          cache-dependency-path: backend/requirements-dev.txt
      - run: pip install -r requirements-dev.txt
      - name: Lint
        run: ruff check . ../api && ruff format --check . ../api
      - name: Test with coverage
        run: pytest --cov=app --cov-report=term-missing --cov-fail-under=95

  frontend:
    runs-on: ubuntu-latest
    defaults:
      run:
        working-directory: frontend
    steps:
      - uses: actions/checkout@v4
      - uses: actions/setup-node@v4
        with:
          node-version: 20
          cache: npm
          cache-dependency-path: frontend/package-lock.json
      - run: npm ci
      - run: npm run lint
      - run: npm run typecheck
      - run: npm test
      - run: npm run build

  docker:
    runs-on: ubuntu-latest
    needs: [backend, frontend]
    steps:
      - uses: actions/checkout@v4
      - name: Build image
        run: docker build -t gridbrick:ci .
      - name: Smoke test
        run: |
          docker run -d -p 8000:8000 --name app gridbrick:ci
          for i in $(seq 1 30); do curl -fs localhost:8000/api/health && break; sleep 1; done
          curl -fs localhost:8000/api/meta
          curl -fs localhost:8000/ | grep -q "<title>"
```

- [ ] **Step 5: Commit, PR, merge**

```bash
git add .github backend frontend/eslint.config.js frontend/package.json frontend/package-lock.json api
git commit -m "ci: add ruff, eslint and a GitHub Actions pipeline with coverage gate and Docker smoke test"
git push -u origin HEAD && gh pr create --fill
```
Wait for the three CI jobs to pass on the PR, then:
```bash
gh pr merge --merge --delete-branch && git checkout main && git pull
```
No deploy needed: the app's behaviour is unchanged.

---

### Task 2: Versioned API with one error shape

**Files:**
- Create: `backend/app/deps.py`, `backend/app/errors.py`, `backend/app/routes.py`
- Replace: `backend/app/main.py`, `backend/app/schemas.py`, `backend/tests/test_api.py`, `frontend/src/api.ts`, `frontend/src/api.test.ts`
- Modify: `backend/app/config.py` (add `API_VERSION`)

**Interfaces:**
- Produces:
  - **Routes:** `/api/v1/{health,meta,decision,accuracy,accuracy/by-horizon}`. The same routes stay at `/api/*` as a deprecated alias, hidden from OpenAPI.
  - **Error body:** every error is `{"error": {"code": str, "message": str, "request_id"?: str, "details"?: [{"field", "message"}]}}`. Codes are `out_of_window` (400), `invalid_range` (400), `invalid_request` (422), `not_found` (404) and `internal_error` (500, Task 3).
  - **Cache header:** successful `GET /api/**` responses other than health carry `Cache-Control: public, max-age=300, s-maxage=86400`.
  - **Python:**
    - `app.deps.get_dataset() -> Dataset` and `DatasetDep`
    - `app.errors.ApiError(status_code, code, message)`
    - `error_response(status, code, message, request, details=None) -> JSONResponse`
    - `install_error_handlers(app)`
    - `create_app(static_dir: Path | None = STATIC_DIR) -> FastAPI` (the `dataset_provider` argument is removed; tests use `app.dependency_overrides[get_dataset]`)
  - **Schemas:** `ErrorBody`, `ErrorResponse`, `Health(status, data_source, forecast_runs, actual_periods)`.
  - **Frontend:** `api.*` calls `/api/v1/...` and throws `Error(body.error.message)`.

- [ ] **Step 1: Branch**

```bash
git checkout main && git pull && git checkout -b improve/2-versioned-api
```

- [ ] **Step 2: Write the failing API tests**

**`backend/tests/test_api.py`** (replace)
```python
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
```

Note: `actual_periods` is 288 because the synthetic dataset has 6 days × 48 half-hours.

Run: `cd backend && .venv/Scripts/python -m pytest tests/test_api.py -q`
Expected: FAIL with `ModuleNotFoundError: No module named 'app.deps'`.

- [ ] **Step 3: Implement dependencies, errors, router and app factory**

**`backend/app/config.py`** — add at the end:
```python
API_VERSION = "1.0.0"
```

**`backend/app/deps.py`** (create)
```python
"""FastAPI dependencies. Tests swap the dataset with app.dependency_overrides[get_dataset]."""

from typing import Annotated

from fastapi import Depends

from app.store import Dataset
from app.store import get_dataset as load_dataset


def get_dataset() -> Dataset:
    return load_dataset()


DatasetDep = Annotated[Dataset, Depends(get_dataset)]
```

**`backend/app/errors.py`** (create)
```python
"""One error shape for every failure, so clients only ever parse {"error": {...}}."""

from fastapi import FastAPI, HTTPException, Request
from fastapi.exceptions import RequestValidationError
from fastapi.responses import JSONResponse
from starlette.exceptions import HTTPException as StarletteHTTPException

_DEFAULT_CODES = {400: "bad_request", 404: "not_found", 405: "method_not_allowed", 422: "invalid_request"}


class ApiError(HTTPException):
    """An expected client error with a stable, machine-readable code."""

    def __init__(self, status_code: int, code: str, message: str):
        super().__init__(status_code=status_code, detail=message)
        self.code = code


def error_response(
    status: int, code: str, message: str, request: Request, details: list[dict[str, str]] | None = None
) -> JSONResponse:
    body: dict[str, object] = {"code": code, "message": message}
    request_id = getattr(request.state, "request_id", None)
    if request_id:
        body["request_id"] = request_id
    if details:
        body["details"] = details
    return JSONResponse(status_code=status, content={"error": body})


def install_error_handlers(app: FastAPI) -> None:
    @app.exception_handler(StarletteHTTPException)
    async def http_error(request: Request, exc: StarletteHTTPException) -> JSONResponse:
        code = getattr(exc, "code", None) or _DEFAULT_CODES.get(exc.status_code, "error")
        return error_response(exc.status_code, code, str(exc.detail), request)

    @app.exception_handler(RequestValidationError)
    async def validation_error(request: Request, exc: RequestValidationError) -> JSONResponse:
        details = [{"field": ".".join(str(p) for p in e["loc"][1:]), "message": e["msg"]} for e in exc.errors()]
        return error_response(422, "invalid_request", "One or more parameters are invalid.", request, details)
```

**`backend/app/schemas.py`** (replace)
```python
"""API response contract. The frontend types are generated from this via OpenAPI."""

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
    default_gate_time_utc: str
    max_horizon_hours: int
    forecast_runs: int
    data_source: Literal["snapshot", "live"]


class Health(BaseModel):
    status: Literal["ok"]
    data_source: Literal["snapshot", "live"]
    forecast_runs: int
    actual_periods: int


class ErrorDetail(BaseModel):
    field: str
    message: str


class ErrorBody(BaseModel):
    code: str
    message: str
    request_id: str | None = None
    details: list[ErrorDetail] | None = None


class ErrorResponse(BaseModel):
    error: ErrorBody
```

**`backend/app/routes.py`** (create)
```python
"""Version 1 of the HTTP API. Handlers stay thin: validate input, call analytics, return a schema.

Handlers are plain `def`: the work is CPU-bound pandas, which FastAPI runs in its threadpool.
"""

from datetime import date, time, timedelta
from typing import Annotated

import pandas as pd
from fastapi import APIRouter, Query

from app import analytics
from app.config import DEFAULT_GATE_CLOSURE_UTC, FIRST_DELIVERY_DATE, LAST_DELIVERY_DATE, MAX_HORIZON_HOURS
from app.deps import DatasetDep
from app.errors import ApiError
from app.schemas import AccuracyResponse, DecisionResponse, ErrorResponse, Health, HorizonRow, Meta

router = APIRouter(
    responses={
        400: {"model": ErrorResponse, "description": "Request outside the supported range"},
        422: {"model": ErrorResponse, "description": "Invalid parameters"},
    }
)

DeliveryDate = Annotated[
    date, Query(description=f"Delivery day (UTC), {FIRST_DELIVERY_DATE} to {LAST_DELIVERY_DATE}", examples=["2026-01-15"])
]
GateTime = Annotated[time, Query(description="Gate closure on D-1, HH:MM UTC", examples=["09:20"])]
Horizon = Annotated[
    int, Query(ge=0, le=MAX_HORIZON_HOURS, description="Minimum hours between forecast publication and delivery")
]
StartDate = Annotated[date | None, Query(description="First delivery day to include (default: start of window)")]
EndDate = Annotated[date | None, Query(description="Last delivery day to include, inclusive (default: end of window)")]


def _window(start: date | None, end: date | None) -> tuple[pd.Timestamp, pd.Timestamp]:
    """Inclusive date range -> half-open UTC timestamp range."""
    start = start or FIRST_DELIVERY_DATE
    end = end or LAST_DELIVERY_DATE
    if start > end:
        raise ApiError(400, "invalid_range", "start must be on or before end")
    return (
        pd.Timestamp(start.isoformat(), tz="UTC"),
        pd.Timestamp((end + timedelta(days=1)).isoformat(), tz="UTC"),
    )


@router.get("/health", response_model=Health, tags=["system"], summary="Liveness and loaded dataset")
def health(ds: DatasetDep) -> Health:
    return Health(
        status="ok",
        data_source=ds.source,
        forecast_runs=int(ds.forecasts["publish_time"].nunique()),
        actual_periods=len(ds.actuals),
    )


@router.get("/meta", response_model=Meta, tags=["reference"], summary="Delivery window and defaults")
def meta(ds: DatasetDep) -> Meta:
    return Meta(
        first_delivery_date=FIRST_DELIVERY_DATE,
        last_delivery_date=LAST_DELIVERY_DATE,
        default_gate_time_utc=DEFAULT_GATE_CLOSURE_UTC.strftime("%H:%M"),
        max_horizon_hours=MAX_HORIZON_HOURS,
        forecast_runs=int(ds.forecasts["publish_time"].nunique()),
        data_source=ds.source,
    )


@router.get(
    "/decision",
    response_model=DecisionResponse,
    tags=["decision"],
    summary="Forecast available at gate closure for one delivery day",
)
def decision(ds: DatasetDep, delivery_date: DeliveryDate, gate_time: GateTime = DEFAULT_GATE_CLOSURE_UTC) -> dict:
    if not FIRST_DELIVERY_DATE <= delivery_date <= LAST_DELIVERY_DATE:
        raise ApiError(
            400, "out_of_window", f"delivery_date must be between {FIRST_DELIVERY_DATE} and {LAST_DELIVERY_DATE}"
        )
    return analytics.decision_view(ds.forecasts, ds.actuals, delivery_date, gate_time)


@router.get("/accuracy", response_model=AccuracyResponse, tags=["accuracy"], summary="Forecast accuracy at one horizon")
def accuracy(ds: DatasetDep, horizon: Horizon = 24, start: StartDate = None, end: EndDate = None) -> dict:
    lo, hi = _window(start, end)
    return analytics.accuracy_view(ds.forecasts, ds.actuals, horizon, lo, hi)


@router.get(
    "/accuracy/by-horizon",
    response_model=list[HorizonRow],
    tags=["accuracy"],
    summary="Error metrics for every 3 h horizon from 0 to 48 h",
)
def by_horizon(ds: DatasetDep, start: StartDate = None, end: EndDate = None) -> list[dict]:
    lo, hi = _window(start, end)
    return analytics.horizon_profile(ds.forecasts, ds.actuals, lo, hi)
```

**`backend/app/main.py`** (replace)
```python
"""App factory: wires routes, error handling and the built frontend."""

from pathlib import Path

from fastapi import FastAPI, Request
from fastapi.staticfiles import StaticFiles

from app.config import API_VERSION, STATIC_DIR
from app.errors import install_error_handlers
from app.routes import router

# The data is a fixed January 2026 snapshot, so successful reads can be cached; the CDN keeps them for a day
# and a new deployment invalidates them.
CACHE_CONTROL = "public, max-age=300, s-maxage=86400"


def create_app(static_dir: Path | None = STATIC_DIR) -> FastAPI:
    app = FastAPI(
        title="GridBrick API",
        version=API_VERSION,
        description="GB wind forecasts available at day-ahead gate closure, and how accurate they were.",
        openapi_tags=[
            {"name": "decision", "description": "What the forecast said when the buyer had to commit"},
            {"name": "accuracy", "description": "How forecast error depends on lead time"},
            {"name": "reference", "description": "Window and defaults the UI needs"},
            {"name": "system", "description": "Operational endpoints"},
        ],
    )
    install_error_handlers(app)

    @app.middleware("http")
    async def cache_headers(request: Request, call_next):
        response = await call_next(request)
        path = request.url.path
        if request.method == "GET" and response.status_code == 200 and path.startswith("/api/"):
            if not path.endswith("/health"):
                response.headers["Cache-Control"] = CACHE_CONTROL
        return response

    app.include_router(router, prefix="/api/v1")
    # Unversioned alias so existing links and clients keep working; hidden from the schema.
    app.include_router(router, prefix="/api", include_in_schema=False, deprecated=True)

    if static_dir is not None and static_dir.is_dir():
        app.mount("/", StaticFiles(directory=static_dir, html=True), name="static")
    return app


app = create_app()
```

Run: `cd backend && .venv/Scripts/python -m pytest -q && .venv/Scripts/python -m ruff format . ../api && .venv/Scripts/python -m ruff check . ../api`
Expected: all tests pass (14 in `test_api.py`), and ruff is clean.

- [ ] **Step 4: Point the frontend at `/api/v1` and the new error shape**

**`frontend/src/api.test.ts`** (replace)
```ts
import { api } from "./api";

function mockFetch(body: unknown, ok = true, status = 200) {
  const fn = vi.fn().mockResolvedValue({ ok, status, json: async () => body });
  vi.stubGlobal("fetch", fn);
  return fn;
}

afterEach(() => vi.unstubAllGlobals());

describe("api", () => {
  it("calls the versioned decision endpoint", async () => {
    const fetchMock = mockFetch({ points: [] });
    await api.decision("2026-01-15", "09:20");
    expect(fetchMock).toHaveBeenCalledWith("/api/v1/decision?delivery_date=2026-01-15&gate_time=09%3A20");
  });
  it("calls meta without a query string", async () => {
    const fetchMock = mockFetch({});
    await api.meta();
    expect(fetchMock).toHaveBeenCalledWith("/api/v1/meta");
  });
  it("surfaces the error envelope message", async () => {
    mockFetch({ error: { code: "out_of_window", message: "delivery_date must be between 2026-01-02 and 2026-02-01" } }, false, 400);
    await expect(api.decision("2026-03-01", "09:20")).rejects.toThrow("delivery_date must be between");
  });
  it("falls back to the status code when the body has no error envelope", async () => {
    mockFetch({ detail: "upstream" }, false, 502);
    await expect(api.accuracy(24)).rejects.toThrow("Request failed: 502");
  });
});
```

**`frontend/src/api.ts`** (replace)
```ts
import type { AccuracyResponse, DecisionResponse, HorizonRow, Meta } from "./types";

const BASE = "/api/v1";

interface ErrorEnvelope {
  error?: { code?: string; message?: string; request_id?: string };
}

async function getJson<T>(path: string, params: Record<string, string | number> = {}): Promise<T> {
  const qs = new URLSearchParams(Object.entries(params).map(([k, v]) => [k, String(v)])).toString();
  const res = await fetch(qs ? `${BASE}${path}?${qs}` : `${BASE}${path}`);
  const body = await res.json().catch(() => ({}));
  if (!res.ok) {
    throw new Error((body as ErrorEnvelope).error?.message ?? `Request failed: ${res.status}`);
  }
  return body as T;
}

export const api = {
  meta: () => getJson<Meta>("/meta"),
  decision: (deliveryDate: string, gateTime: string) =>
    getJson<DecisionResponse>("/decision", { delivery_date: deliveryDate, gate_time: gateTime }),
  accuracy: (horizon: number) => getJson<AccuracyResponse>("/accuracy", { horizon }),
  byHorizon: () => getJson<HorizonRow[]>("/accuracy/by-horizon"),
};
```

Run: `cd frontend && npm run lint && npm run typecheck && npm test && npm run build`
Expected: all pass.

- [ ] **Step 5: Commit, PR, merge, deploy**

```bash
git add backend frontend/src/api.ts frontend/src/api.test.ts
git commit -m "feat(api): version routes under /api/v1 with one error envelope, Depends-based dataset and cache headers"
git push -u origin HEAD && gh pr create --fill
```
After CI passes:
```bash
gh pr merge --merge --delete-branch && git checkout main && git pull && npx vercel deploy --prod --yes
curl -s https://4eaez3.vercel.app/api/v1/health
curl -sI "https://4eaez3.vercel.app/api/v1/meta" | grep -i cache-control
curl -s "https://4eaez3.vercel.app/api/v1/decision?delivery_date=2026-03-01"
```
Expected:
- `/api/v1/health` returns its JSON.
- `/api/v1/meta` shows the `Cache-Control` header.
- The out-of-window request returns `{"error":{"code":"out_of_window",...}}`.
- The app loads in the browser.

---

### Task 3: Observability — JSON logs, request ids, timing, 500 handler

**Files:**
- Create: `backend/app/observability.py`, `backend/tests/test_observability.py`
- Modify: `backend/app/main.py` (wire it in)

**Interfaces:**
- Consumes: `error_response` (Task 2).
- Produces:
  - `configure_logging(level: int = logging.INFO) -> None`
  - `JsonFormatter`
  - `install_observability(app: FastAPI) -> None`
  - `REQUEST_ID_HEADER = "X-Request-ID"`
- Behaviour:
  - Every response has `X-Request-ID`. A valid incoming id (`[A-Za-z0-9-]{1,64}`) is echoed; anything else gets a fresh 32-hex id.
  - Each request writes one log record `request` with `request_id`, `method`, `path`, `status` and `duration_ms`.
  - An unhandled exception gives a 500 `{"error": {"code": "internal_error", "message": ..., "request_id": ...}}` and an ERROR log with the traceback.

- [ ] **Step 1: Branch**

```bash
git checkout main && git pull && git checkout -b improve/3-observability
```

- [ ] **Step 2: Write the failing tests**

**`backend/tests/test_observability.py`** (create)
```python
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
```

Run: `cd backend && .venv/Scripts/python -m pytest tests/test_observability.py -q`
Expected: FAIL with `ModuleNotFoundError: No module named 'app.observability'`.

- [ ] **Step 3: Implement**

**`backend/app/observability.py`** (create)
```python
"""Structured JSON logs, a request id on every response, and one timing line per request."""

import json
import logging
import re
import time
import uuid

from fastapi import FastAPI, Request

from app.errors import error_response

logger = logging.getLogger("gridbrick")
REQUEST_ID_HEADER = "X-Request-ID"
_SAFE_REQUEST_ID = re.compile(r"[A-Za-z0-9-]{1,64}")


class JsonFormatter(logging.Formatter):
    def format(self, record: logging.LogRecord) -> str:
        payload = {"level": record.levelname.lower(), "logger": record.name, "message": record.getMessage()}
        payload.update(getattr(record, "fields", {}))
        if record.exc_info:
            payload["exc_info"] = self.formatException(record.exc_info)
        return json.dumps(payload, default=str)


def configure_logging(level: int = logging.INFO) -> None:
    handler = logging.StreamHandler()
    handler.setFormatter(JsonFormatter())
    logger.handlers[:] = [handler]
    logger.setLevel(level)


def _request_id(request: Request) -> str:
    incoming = request.headers.get(REQUEST_ID_HEADER, "")
    # Only trust ids that can't inject into logs or headers.
    return incoming if _SAFE_REQUEST_ID.fullmatch(incoming) else uuid.uuid4().hex


def install_observability(app: FastAPI) -> None:
    @app.middleware("http")
    async def request_context(request: Request, call_next):
        request_id = _request_id(request)
        request.state.request_id = request_id
        started = time.perf_counter()
        try:
            response = await call_next(request)
        except Exception:
            logger.exception("unhandled error", extra={"fields": {"request_id": request_id, "path": request.url.path}})
            response = error_response(500, "internal_error", "Something went wrong on our side.", request)
        response.headers[REQUEST_ID_HEADER] = request_id
        logger.info(
            "request",
            extra={
                "fields": {
                    "request_id": request_id,
                    "method": request.method,
                    "path": request.url.path,
                    "status": response.status_code,
                    "duration_ms": round((time.perf_counter() - started) * 1000, 1),
                }
            },
        )
        return response
```

**`backend/app/main.py`** — edit:
- Add the import `from app.observability import configure_logging, install_observability`.
- Add `configure_logging()` on the line above `def create_app`.
- Add `install_observability(app)` directly before `app.include_router(router, prefix="/api/v1")`. It comes after the `cache_headers` middleware, so it is the outermost middleware and wraps everything.

The resulting block:
```python
configure_logging()


def create_app(static_dir: Path | None = STATIC_DIR) -> FastAPI:
    ...
    @app.middleware("http")
    async def cache_headers(request: Request, call_next):
        ...

    install_observability(app)
    app.include_router(router, prefix="/api/v1")
```

Run: `cd backend && .venv/Scripts/python -m pytest -q --cov=app --cov-fail-under=95 && .venv/Scripts/python -m ruff format . ../api && .venv/Scripts/python -m ruff check . ../api`
Expected: all pass.

- [ ] **Step 4: Commit, PR, merge, deploy**

```bash
git add backend
git commit -m "feat(api): structured JSON logs, request ids and a 500 error envelope"
git push -u origin HEAD && gh pr create --fill
```
After CI passes:
```bash
gh pr merge --merge --delete-branch && git checkout main && git pull && npx vercel deploy --prod --yes
curl -sI https://4eaez3.vercel.app/api/v1/meta | grep -i x-request-id
```
Expected: an `x-request-id` header. Vercel function logs show one JSON `request` line per call.

---

### Task 4: Generate frontend types from the API contract

**Files:**
- Create: `backend/scripts/export_openapi.py`, `backend/tests/test_contract.py`, `frontend/openapi.json` (generated), `frontend/src/schema.d.ts` (generated)
- Replace: `frontend/src/types.ts`, `frontend/eslint.config.js`, `.github/workflows/ci.yml`
- Modify: `frontend/package.json` (script and devDependency)

**Interfaces:**
- Consumes: the schemas from Task 2.
- Produces:
  - `npm run gen:api`
  - `python -m scripts.export_openapi`
  - `frontend/src/types.ts` exports `Metrics, DecisionPoint, DecisionResponse, AccuracyPoint, HistogramBin, AccuracyResponse, HorizonRow, Meta, Health, ErrorResponse`, generated from OpenAPI.
  - CI job `api-contract` fails when the committed contract or types drift from the code.

- [ ] **Step 1: Branch**

```bash
git checkout main && git pull && git checkout -b improve/4-api-contract
```

- [ ] **Step 2: Write the failing contract test**

**`backend/tests/test_contract.py`** (create)
```python
import json
from pathlib import Path

from app.main import create_app

OPENAPI = Path(__file__).resolve().parents[2] / "frontend" / "openapi.json"


def test_committed_openapi_matches_the_app():
    committed = json.loads(OPENAPI.read_text(encoding="utf-8"))
    assert committed == create_app(static_dir=None).openapi(), (
        "API schema changed: run `python -m scripts.export_openapi` in backend/ and `npm run gen:api` in frontend/"
    )
```

Run: `cd backend && .venv/Scripts/python -m pytest tests/test_contract.py -q`
Expected: FAIL with `FileNotFoundError` for `frontend/openapi.json`.

- [ ] **Step 3: Export the schema and generate types**

**`backend/scripts/export_openapi.py`** (create)
```python
"""Write the API's OpenAPI document to frontend/openapi.json; the frontend generates its types from it."""

import json
from pathlib import Path

from app.main import create_app

OUT = Path(__file__).resolve().parents[2] / "frontend" / "openapi.json"


def main() -> None:
    spec = create_app(static_dir=None).openapi()
    OUT.write_text(json.dumps(spec, indent=2, sort_keys=True) + "\n", encoding="utf-8", newline="\n")
    print(f"wrote {OUT}")


if __name__ == "__main__":
    main()
```

```bash
cd backend && .venv/Scripts/python -m scripts.export_openapi
cd ../frontend && npm install -D openapi-typescript@^7 && npm pkg set scripts.gen:api="openapi-typescript openapi.json -o src/schema.d.ts" && npm run gen:api
```
Expected: `frontend/openapi.json` and `frontend/src/schema.d.ts` exist.

**`frontend/src/types.ts`** (replace)
```ts
// Generated from the backend's OpenAPI schema. Edit backend/app/schemas.py, then run
// `python -m scripts.export_openapi` (backend/) and `npm run gen:api` (frontend/). Never edit schema.d.ts by hand.
import type { components } from "./schema";

type Schemas = components["schemas"];

export type Metrics = Schemas["Metrics"];
export type DecisionPoint = Schemas["DecisionPoint"];
export type DecisionResponse = Schemas["DecisionResponse"];
export type AccuracyPoint = Schemas["AccuracyPoint"];
export type HistogramBin = Schemas["HistogramBin"];
export type AccuracyResponse = Schemas["AccuracyResponse"];
export type HorizonRow = Schemas["HorizonRow"];
export type Meta = Schemas["Meta"];
export type Health = Schemas["Health"];
export type ErrorResponse = Schemas["ErrorResponse"];
```

**`frontend/eslint.config.js`** (replace)
```js
import js from "@eslint/js";
import reactHooks from "eslint-plugin-react-hooks";
import globals from "globals";
import tseslint from "typescript-eslint";

export default tseslint.config(
  { ignores: ["dist", "src/schema.d.ts"] },
  {
    extends: [js.configs.recommended, ...tseslint.configs.recommended],
    files: ["**/*.{ts,tsx}"],
    languageOptions: { ecmaVersion: 2022, globals: globals.browser },
    plugins: { "react-hooks": reactHooks },
    rules: { ...reactHooks.configs.recommended.rules },
  },
);
```

Run:
```bash
cd backend && .venv/Scripts/python -m pytest -q
cd ../frontend && npm run lint && npm run typecheck && npm test && npm run build
```
Expected: all pass. If `typecheck` reports a mismatch between a fixture and the generated types, the generated type is the source of truth. Correct the fixture in `src/test/fixtures.ts` to match the schema; never edit `schema.d.ts`.

- [ ] **Step 4: Add the drift check to CI**

**`.github/workflows/ci.yml`** — insert this job between `frontend` and `docker`, and change the `docker` job's `needs` to `[backend, frontend, api-contract]`:
```yaml
  api-contract:
    runs-on: ubuntu-latest
    steps:
      - uses: actions/checkout@v4
      - uses: actions/setup-python@v5
        with:
          python-version: "3.12"
          cache: pip
          cache-dependency-path: backend/requirements.txt
      - uses: actions/setup-node@v4
        with:
          node-version: 20
          cache: npm
          cache-dependency-path: frontend/package-lock.json
      - run: pip install -r backend/requirements.txt
      - run: python -m scripts.export_openapi
        working-directory: backend
      - run: npm ci && npm run gen:api
        working-directory: frontend
      - name: Fail if the committed contract or types are stale
        run: git diff --exit-code -- frontend/openapi.json frontend/src/schema.d.ts
```

- [ ] **Step 5: Commit, PR, merge**

```bash
git add backend frontend .github
git commit -m "build: generate frontend API types from OpenAPI and fail CI on contract drift"
git push -u origin HEAD && gh pr create --fill
```
After CI passes:
```bash
gh pr merge --merge --delete-branch && git checkout main && git pull
```
Only types changed, so there's nothing to deploy.

---

### Task 5: Client state — shareable URLs, query cache with cancellation, request ids in errors

**Files:**
- Create:
  - State: `frontend/src/state/viewState.ts`, `frontend/src/state/viewState.test.ts`, `frontend/src/state/useViewState.ts`
  - Data: `frontend/src/data/useQuery.ts`, `frontend/src/data/useQuery.test.tsx`
- Replace:
  - Data and API: `frontend/src/api.ts`, `frontend/src/api.test.ts`
  - App and views: `frontend/src/App.tsx`, `frontend/src/components/DecisionView.tsx`, `frontend/src/components/AccuracyView.tsx`, `frontend/src/components/feedback/ErrorPanel.tsx`, `frontend/src/components/feedback/ErrorPanel.module.css`
  - Tests: `frontend/src/setupTests.ts`, `frontend/src/App.test.tsx`, `frontend/src/components/DecisionView.test.tsx`, `frontend/src/components/AccuracyView.test.tsx`
- Delete: `frontend/src/useAsync.ts`

**Interfaces:**
- Consumes: `types.ts` (Task 4); `TopBar`, `Tab`, `DayStepper`, `Select`, `HorizonSlider`, `GATE_OPTIONS`, `PageHeader`, `Panel`, `Skeleton`, chart components (existing).
- Produces:
  - **API:** `class ApiError extends Error { status: number; code?: string; requestId?: string }`. Each `api.*` call takes an optional `signal?: AbortSignal` as its last argument and calls `fetch(url, { signal })`.
  - **Data:** `useQuery<T>(key: string, fetcher: (signal: AbortSignal) => Promise<T>): { data: T | null; error: Error | null; loading: boolean; reload: () => void }` and `clearQueryCache(): void`.
  - **URL state:**
    - `ViewState = { tab: Tab; day: string; gate: string; horizon: number }`
    - `ViewLimits = { days: string[]; gates: string[]; maxHorizon: number; defaultGate: string; defaultHorizon: number }`
    - `readViewState(search: string, limits: ViewLimits): ViewState` and `toSearch(state: ViewState): string`
    - `useViewState(limits): readonly [ViewState, (patch: Partial<ViewState>) => void]`
  - **UI:** `ErrorPanel({ message, onRetry, reference?: string })`.

- [ ] **Step 1: Branch**

```bash
git checkout main && git pull && git checkout -b improve/5-client-state
```

- [ ] **Step 2: Write the failing tests**

**`frontend/src/state/viewState.test.ts`** (create)
```ts
import { readViewState, toSearch, type ViewLimits } from "./viewState";

const limits: ViewLimits = {
  days: ["2026-01-02", "2026-01-03"],
  gates: ["09:20", "09:50"],
  maxHorizon: 48,
  defaultGate: "09:20",
  defaultHorizon: 24,
};

describe("viewState", () => {
  it("reads a full, valid query string", () => {
    expect(readViewState("?tab=accuracy&day=2026-01-03&gate=09%3A50&h=6", limits)).toEqual({
      tab: "accuracy",
      day: "2026-01-03",
      gate: "09:50",
      horizon: 6,
    });
  });
  it("falls back to defaults for missing or invalid values", () => {
    expect(readViewState("?tab=nope&day=2025-12-01&gate=11:00&h=99", limits)).toEqual({
      tab: "decision",
      day: "2026-01-02",
      gate: "09:20",
      horizon: 24,
    });
    expect(readViewState("", limits).tab).toBe("decision");
  });
  it("rejects non-integer and empty horizons", () => {
    expect(readViewState("?h=6.5", limits).horizon).toBe(24);
    expect(readViewState("?h=", limits).horizon).toBe(24);
    expect(readViewState("?h=0", limits).horizon).toBe(0);
  });
  it("round-trips through the query string", () => {
    const state = { tab: "accuracy", day: "2026-01-03", gate: "09:50", horizon: 12 } as const;
    expect(readViewState(toSearch(state), limits)).toEqual(state);
  });
});
```

**`frontend/src/data/useQuery.test.tsx`** (create)
```tsx
import { act, renderHook, waitFor } from "@testing-library/react";
import { clearQueryCache, useQuery } from "./useQuery";

afterEach(() => clearQueryCache());

describe("useQuery", () => {
  it("serves a cached key without refetching", async () => {
    const fetcher = vi.fn().mockResolvedValue("first");
    const one = renderHook(() => useQuery("k", fetcher));
    await waitFor(() => expect(one.result.current.data).toBe("first"));
    const two = renderHook(() => useQuery("k", fetcher));
    expect(two.result.current.data).toBe("first");
    expect(two.result.current.loading).toBe(false);
    expect(fetcher).toHaveBeenCalledTimes(1);
  });

  it("aborts the previous request when the key changes", () => {
    const signals: AbortSignal[] = [];
    const fetcher = (signal: AbortSignal) => {
      signals.push(signal);
      return new Promise<string>(() => {});
    };
    const { rerender } = renderHook(({ k }) => useQuery(k, fetcher), { initialProps: { k: "a" } });
    rerender({ k: "b" });
    expect(signals[0].aborted).toBe(true);
    expect(signals[signals.length - 1].aborted).toBe(false);
  });

  it("keeps the previous data while a new key loads", async () => {
    const fetchFor = (k: string) => () => (k === "a" ? Promise.resolve("A") : new Promise<string>(() => {}));
    const { result, rerender } = renderHook(({ k }) => useQuery(k, fetchFor(k)), { initialProps: { k: "a" } });
    await waitFor(() => expect(result.current.data).toBe("A"));
    rerender({ k: "b" });
    expect(result.current.data).toBe("A");
    expect(result.current.loading).toBe(true);
  });

  it("reload drops the cache entry and refetches", async () => {
    const fetcher = vi.fn().mockResolvedValueOnce(1).mockResolvedValueOnce(2);
    const { result } = renderHook(() => useQuery("n", fetcher));
    await waitFor(() => expect(result.current.data).toBe(1));
    act(() => result.current.reload());
    await waitFor(() => expect(result.current.data).toBe(2));
    expect(fetcher).toHaveBeenCalledTimes(2);
  });

  it("exposes errors as Error objects", async () => {
    const { result } = renderHook(() => useQuery("e", () => Promise.reject(new Error("nope"))));
    await waitFor(() => expect(result.current.error?.message).toBe("nope"));
    expect(result.current.loading).toBe(false);
  });
});
```

**`frontend/src/api.test.ts`** (replace)
```ts
import { api, ApiError } from "./api";

function mockFetch(body: unknown, ok = true, status = 200) {
  const fn = vi.fn().mockResolvedValue({ ok, status, json: async () => body });
  vi.stubGlobal("fetch", fn);
  return fn;
}

afterEach(() => vi.unstubAllGlobals());

describe("api", () => {
  it("calls the versioned decision endpoint and forwards the abort signal", async () => {
    const fetchMock = mockFetch({ points: [] });
    const controller = new AbortController();
    await api.decision("2026-01-15", "09:20", controller.signal);
    expect(fetchMock).toHaveBeenCalledWith("/api/v1/decision?delivery_date=2026-01-15&gate_time=09%3A20", {
      signal: controller.signal,
    });
  });
  it("calls meta without a query string", async () => {
    const fetchMock = mockFetch({});
    await api.meta();
    expect(fetchMock).toHaveBeenCalledWith("/api/v1/meta", { signal: undefined });
  });
  it("throws ApiError with code and request id from the envelope", async () => {
    mockFetch({ error: { code: "out_of_window", message: "delivery_date must be between", request_id: "abc123" } }, false, 400);
    const error = await api.decision("2026-03-01", "09:20").catch((e: unknown) => e);
    expect(error).toBeInstanceOf(ApiError);
    expect(error).toMatchObject({ message: "delivery_date must be between", status: 400, code: "out_of_window", requestId: "abc123" });
  });
  it("falls back to the status code when the body has no error envelope", async () => {
    mockFetch({ detail: "upstream" }, false, 502);
    await expect(api.accuracy(24)).rejects.toThrow("Request failed: 502");
  });
});
```

**`frontend/src/setupTests.ts`** (replace)
```ts
import "@testing-library/jest-dom/vitest";
import { clearQueryCache } from "./data/useQuery";

// Recharts' ResponsiveContainer needs ResizeObserver, which jsdom lacks.
class ResizeObserverStub {
  observe() {}
  unobserve() {}
  disconnect() {}
}
globalThis.ResizeObserver = ResizeObserverStub as unknown as typeof ResizeObserver;

afterEach(() => {
  clearQueryCache();
  window.history.replaceState(null, "", "/");
});
```

**`frontend/src/App.test.tsx`** (replace)
```tsx
import { fireEvent, render, screen } from "@testing-library/react";
import App from "./App";
import { api } from "./api";
import { accuracyFixture, decisionFixture, horizonFixture, metaFixture } from "./test/fixtures";

vi.mock("./api", async (importOriginal) => ({
  ...(await importOriginal<typeof import("./api")>()),
  api: { meta: vi.fn(), decision: vi.fn(), accuracy: vi.fn(), byHorizon: vi.fn() },
}));

const anySignal = expect.any(AbortSignal);

beforeEach(() => {
  vi.mocked(api.meta).mockResolvedValue(metaFixture);
  vi.mocked(api.decision).mockResolvedValue(decisionFixture);
  vi.mocked(api.accuracy).mockResolvedValue(accuracyFixture);
  vi.mocked(api.byHorizon).mockResolvedValue(horizonFixture);
});

it("switches tabs and swaps the top-bar controls", async () => {
  render(<App />);
  expect(await screen.findByText("Shortfall at risk (P10)")).toBeInTheDocument();
  expect(screen.getByLabelText("Delivery day")).toBeInTheDocument();
  fireEvent.click(screen.getByRole("button", { name: "Forecast accuracy" }));
  expect(await screen.findByText("Mean absolute error")).toBeInTheDocument();
  expect(screen.getByLabelText(/Forecast horizon/)).toBeInTheDocument();
  expect(screen.queryByLabelText("Delivery day")).not.toBeInTheDocument();
});

it("steps to the next delivery day and records it in the URL", async () => {
  render(<App />);
  await screen.findByText("Shortfall at risk (P10)");
  fireEvent.click(screen.getByRole("button", { name: "Next day" }));
  expect(api.decision).toHaveBeenLastCalledWith("2026-01-03", "09:20", anySignal);
  expect(window.location.search).toContain("day=2026-01-03");
});

it("changes gate closure from the top bar", async () => {
  render(<App />);
  await screen.findByText("Shortfall at risk (P10)");
  fireEvent.change(screen.getByLabelText("Gate closure on D-1"), { target: { value: "09:50" } });
  expect(api.decision).toHaveBeenLastCalledWith("2026-01-02", "09:50", anySignal);
});

it("restores the view from a shared link", async () => {
  window.history.replaceState(null, "", "/?tab=accuracy&h=6");
  render(<App />);
  expect(await screen.findByText("Mean absolute error")).toBeInTheDocument();
  expect(api.accuracy).toHaveBeenCalledWith(6, anySignal);
});
```

**`frontend/src/components/DecisionView.test.tsx`** (replace)
```tsx
import { fireEvent, render, screen } from "@testing-library/react";
import { api, ApiError } from "../api";
import { decisionFixture } from "../test/fixtures";
import { DecisionView } from "./DecisionView";

vi.mock("../api", async (importOriginal) => ({
  ...(await importOriginal<typeof import("../api")>()),
  api: { meta: vi.fn(), decision: vi.fn(), accuracy: vi.fn(), byHorizon: vi.fn() },
}));

const anySignal = expect.any(AbortSignal);

beforeEach(() => {
  vi.mocked(api.decision).mockReset();
  vi.mocked(api.decision).mockResolvedValue(decisionFixture);
});

describe("DecisionView", () => {
  it("shows the shortfall, energy figures and forecast run in the rail", async () => {
    render(<DecisionView deliveryDate="2026-01-02" gateTime="09:20" />);
    expect(await screen.findByText("Shortfall at risk (P10)")).toBeInTheDocument();
    expect(api.decision).toHaveBeenCalledWith("2026-01-02", "09:20", anySignal);
    expect(screen.getByText("0.5 GWh")).toBeInTheDocument();
    expect(screen.getAllByText("2.2 GWh")).toHaveLength(2);
    expect(screen.getByText("Thu 1 Jan, 07:30 UTC")).toBeInTheDocument();
    expect(screen.getByText(/latest before the 09:20 gate/)).toBeInTheDocument();
  });

  it("explains when there is no likely range yet", async () => {
    const points = decisionFixture.points.map((p) => ({ ...p, low_mw: null, high_mw: null }));
    vi.mocked(api.decision).mockResolvedValue({ ...decisionFixture, points });
    render(<DecisionView deliveryDate="2026-01-02" gateTime="09:20" />);
    expect(await screen.findByText("Not enough history yet for a likely range.")).toBeInTheDocument();
  });

  it("shows an error with a reference and a retry that refetches", async () => {
    vi.mocked(api.decision).mockRejectedValueOnce(new ApiError("boom", 500, "internal_error", "req-42"));
    render(<DecisionView deliveryDate="2026-01-15" gateTime="09:20" />);
    expect(await screen.findByText("Couldn't load the forecast for Thu 15 Jan 2026.")).toBeInTheDocument();
    expect(screen.getByText("Reference: req-42")).toBeInTheDocument();
    fireEvent.click(screen.getByRole("button", { name: "Try again" }));
    expect(await screen.findByText("Shortfall at risk (P10)")).toBeInTheDocument();
    expect(api.decision).toHaveBeenCalledTimes(2);
  });

  it("keeps the last result and shows updating while refetching", async () => {
    const { rerender } = render(<DecisionView deliveryDate="2026-01-02" gateTime="09:20" />);
    await screen.findByText("Shortfall at risk (P10)");
    vi.mocked(api.decision).mockReturnValue(new Promise(() => {}));
    rerender(<DecisionView deliveryDate="2026-01-15" gateTime="09:50" />);
    expect(api.decision).toHaveBeenLastCalledWith("2026-01-15", "09:50", anySignal);
    expect(await screen.findByText("Updating…")).toBeInTheDocument();
    expect(screen.getByText("Shortfall at risk (P10)")).toBeInTheDocument();
  });

  it("returns instantly to a day it has already loaded", async () => {
    const { rerender } = render(<DecisionView deliveryDate="2026-01-02" gateTime="09:20" />);
    await screen.findByText("Shortfall at risk (P10)");
    rerender(<DecisionView deliveryDate="2026-01-03" gateTime="09:20" />);
    await screen.findByText("Shortfall at risk (P10)");
    rerender(<DecisionView deliveryDate="2026-01-02" gateTime="09:20" />);
    expect(screen.queryByText("Updating…")).not.toBeInTheDocument();
    expect(api.decision).toHaveBeenCalledTimes(2);
  });
});
```

**`frontend/src/components/AccuracyView.test.tsx`** (replace)
```tsx
import { fireEvent, render, screen } from "@testing-library/react";
import { api } from "../api";
import { accuracyFixture, horizonFixture } from "../test/fixtures";
import { AccuracyView } from "./AccuracyView";

vi.mock("../api", async (importOriginal) => ({
  ...(await importOriginal<typeof import("../api")>()),
  api: { meta: vi.fn(), decision: vi.fn(), accuracy: vi.fn(), byHorizon: vi.fn() },
}));

const anySignal = expect.any(AbortSignal);

beforeEach(() => {
  vi.mocked(api.accuracy).mockReset();
  vi.mocked(api.accuracy).mockResolvedValue(accuracyFixture);
  vi.mocked(api.byHorizon).mockResolvedValue(horizonFixture);
});

describe("AccuracyView", () => {
  it("shows the metric strip for the requested horizon", async () => {
    render(<AccuracyView horizon={24} />);
    expect(await screen.findByText("Mean absolute error")).toBeInTheDocument();
    expect(api.accuracy).toHaveBeenCalledWith(24, anySignal);
    expect(screen.getByText("512 MW")).toBeInTheDocument();
    expect(screen.getByText("6.2%")).toBeInTheDocument();
    expect(screen.getByText(/at least 24 h before each hour/)).toBeInTheDocument();
    expect(await screen.findByText("How error grows with lead time")).toBeInTheDocument();
  });

  it("keeps results and shows updating while a new horizon loads", async () => {
    const { rerender } = render(<AccuracyView horizon={24} />);
    await screen.findByText("Mean absolute error");
    vi.mocked(api.accuracy).mockReturnValue(new Promise(() => {}));
    rerender(<AccuracyView horizon={6} />);
    expect(await screen.findByText("Updating…")).toBeInTheDocument();
    expect(screen.getByText("512 MW")).toBeInTheDocument();
  });

  it("shows an error with a retry", async () => {
    vi.mocked(api.accuracy).mockRejectedValueOnce(new Error("boom"));
    render(<AccuracyView horizon={12} />);
    expect(await screen.findByText("Couldn't load accuracy for the 12 h horizon.")).toBeInTheDocument();
    fireEvent.click(screen.getByRole("button", { name: "Try again" }));
    expect(await screen.findByText("Mean absolute error")).toBeInTheDocument();
  });
});
```

Run: `cd frontend && npm test`
Expected: FAIL. `./viewState`, `./useQuery` and `ApiError` can't be resolved, and the view tests fail.

- [ ] **Step 3: Implement**

**`frontend/src/state/viewState.ts`** (create)
```ts
import type { Tab } from "../components/layout/TopBar";

export interface ViewState {
  tab: Tab;
  day: string;
  gate: string;
  horizon: number;
}

export interface ViewLimits {
  days: string[];
  gates: string[];
  maxHorizon: number;
  defaultGate: string;
  defaultHorizon: number;
}

/** Parse the URL query into a view, falling back to defaults for anything missing or out of range. */
export function readViewState(search: string, limits: ViewLimits): ViewState {
  const q = new URLSearchParams(search);
  const day = q.get("day") ?? "";
  const gate = q.get("gate") ?? "";
  const rawHorizon = q.get("h");
  const horizon = rawHorizon !== null && /^\d+$/.test(rawHorizon) ? Number(rawHorizon) : NaN;
  return {
    tab: q.get("tab") === "accuracy" ? "accuracy" : "decision",
    day: limits.days.includes(day) ? day : limits.days[0],
    gate: limits.gates.includes(gate) ? gate : limits.defaultGate,
    horizon: horizon >= 0 && horizon <= limits.maxHorizon ? horizon : limits.defaultHorizon,
  };
}

export function toSearch(state: ViewState): string {
  const q = new URLSearchParams({ tab: state.tab, day: state.day, gate: state.gate, h: String(state.horizon) });
  return `?${q.toString()}`;
}
```

**`frontend/src/state/useViewState.ts`** (create)
```ts
import { useCallback, useEffect, useState } from "react";
import { readViewState, toSearch, type ViewLimits, type ViewState } from "./viewState";

/** View state that lives in the URL, so links can be shared and a refresh keeps the view. */
export function useViewState(limits: ViewLimits) {
  const [state, setState] = useState<ViewState>(() => readViewState(window.location.search, limits));

  useEffect(() => {
    window.history.replaceState(null, "", toSearch(state));
  }, [state]);

  const update = useCallback((patch: Partial<ViewState>) => setState((s) => ({ ...s, ...patch })), []);
  return [state, update] as const;
}
```

**`frontend/src/data/useQuery.ts`** (create)
```ts
import { useCallback, useEffect, useState } from "react";

// The data behind the app is a fixed snapshot, so a result never goes stale within a session.
const cache = new Map<string, unknown>();

export function clearQueryCache(): void {
  cache.clear();
}

interface QueryResult<T> {
  data: T | null;
  error: Error | null;
  loading: boolean;
}

/**
 * Fetch by key with a session cache. Changing the key aborts the in-flight request, and the previous
 * data stays visible while the new key loads, so views can dim instead of flashing empty.
 */
export function useQuery<T>(key: string, fetcher: (signal: AbortSignal) => Promise<T>) {
  const [state, setState] = useState<QueryResult<T>>(() =>
    cache.has(key)
      ? { data: cache.get(key) as T, error: null, loading: false }
      : { data: null, error: null, loading: true },
  );
  const [attempt, setAttempt] = useState(0);

  useEffect(() => {
    if (cache.has(key)) {
      setState({ data: cache.get(key) as T, error: null, loading: false });
      return;
    }
    const controller = new AbortController();
    setState((s) => ({ ...s, loading: true, error: null }));
    fetcher(controller.signal)
      .then((data) => {
        cache.set(key, data);
        if (!controller.signal.aborted) setState({ data, error: null, loading: false });
      })
      .catch((e: unknown) => {
        if (controller.signal.aborted) return;
        setState((s) => ({ ...s, error: e instanceof Error ? e : new Error(String(e)), loading: false }));
      });
    return () => controller.abort();
    // The fetcher is recreated every render; the key captures everything it depends on.
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [key, attempt]);

  const reload = useCallback(() => {
    cache.delete(key);
    setAttempt((n) => n + 1);
  }, [key]);

  return { ...state, reload };
}
```

**`frontend/src/api.ts`** (replace)
```ts
import type { AccuracyResponse, DecisionResponse, ErrorResponse, HorizonRow, Meta } from "./types";

const BASE = "/api/v1";

/** A failed API call, carrying the server's error code and request id for support. */
export class ApiError extends Error {
  constructor(
    message: string,
    readonly status: number,
    readonly code?: string,
    readonly requestId?: string,
  ) {
    super(message);
    this.name = "ApiError";
  }
}

async function getJson<T>(path: string, params: Record<string, string | number>, signal?: AbortSignal): Promise<T> {
  const qs = new URLSearchParams(Object.entries(params).map(([k, v]) => [k, String(v)])).toString();
  const res = await fetch(qs ? `${BASE}${path}?${qs}` : `${BASE}${path}`, { signal });
  const body: unknown = await res.json().catch(() => null);
  if (!res.ok) {
    const error = (body as Partial<ErrorResponse> | null)?.error;
    throw new ApiError(
      error?.message ?? `Request failed: ${res.status}`,
      res.status,
      error?.code,
      error?.request_id ?? undefined,
    );
  }
  return body as T;
}

export const api = {
  meta: (signal?: AbortSignal) => getJson<Meta>("/meta", {}, signal),
  decision: (deliveryDate: string, gateTime: string, signal?: AbortSignal) =>
    getJson<DecisionResponse>("/decision", { delivery_date: deliveryDate, gate_time: gateTime }, signal),
  accuracy: (horizon: number, signal?: AbortSignal) => getJson<AccuracyResponse>("/accuracy", { horizon }, signal),
  byHorizon: (signal?: AbortSignal) => getJson<HorizonRow[]>("/accuracy/by-horizon", {}, signal),
};

export const errorReference = (error: Error | null): string | undefined =>
  error instanceof ApiError ? error.requestId : undefined;
```

**`frontend/src/components/feedback/ErrorPanel.tsx`** (replace)
```tsx
import s from "./ErrorPanel.module.css";

interface ErrorPanelProps {
  message: string;
  onRetry: () => void;
  reference?: string;
}

export function ErrorPanel({ message, onRetry, reference }: ErrorPanelProps) {
  return (
    <div className={s.error} role="alert">
      <div>
        <p>{message}</p>
        {reference && <p className={s.reference}>Reference: {reference}</p>}
      </div>
      <button type="button" className={s.retry} onClick={onRetry}>
        Try again
      </button>
    </div>
  );
}
```

**`frontend/src/components/feedback/ErrorPanel.module.css`** (replace)
```css
.error {
  display: flex;
  justify-content: space-between;
  align-items: center;
  gap: var(--space-4);
  padding: var(--space-4) var(--space-5);
  background: var(--danger-bg);
  color: var(--danger);
  border-radius: var(--radius-panel);
}
.reference {
  margin-top: 2px;
  font-size: var(--text-xs);
}
.retry {
  flex-shrink: 0;
  height: 34px;
  padding: 0 var(--space-4);
  border: 1px solid currentColor;
  border-radius: var(--radius-control);
  background: transparent;
  color: inherit;
  cursor: pointer;
}
```

**`frontend/src/App.tsx`** (replace)
```tsx
import { useMemo } from "react";
import { api } from "./api";
import s from "./App.module.css";
import { AccuracyView } from "./components/AccuracyView";
import { DayStepper } from "./components/controls/DayStepper";
import { GATE_OPTIONS } from "./components/controls/gateOptions";
import { HorizonSlider } from "./components/controls/HorizonSlider";
import { Select } from "./components/controls/Select";
import { DecisionView } from "./components/DecisionView";
import { TopBar } from "./components/layout/TopBar";
import { useQuery } from "./data/useQuery";
import { deliveryDates } from "./format";
import { useViewState } from "./state/useViewState";
import type { ViewLimits } from "./state/viewState";
import type { Meta } from "./types";

const DEFAULT_HORIZON_HOURS = 24;

function Dashboard({ meta }: { meta: Meta }) {
  const days = useMemo(() => deliveryDates(meta.first_delivery_date, meta.last_delivery_date), [meta]);
  const limits = useMemo<ViewLimits>(
    () => ({
      days,
      gates: GATE_OPTIONS.map((g) => g.value),
      maxHorizon: meta.max_horizon_hours,
      defaultGate: meta.default_gate_time_utc,
      defaultHorizon: DEFAULT_HORIZON_HOURS,
    }),
    [days, meta],
  );
  const [view, update] = useViewState(limits);

  const controls =
    view.tab === "decision" ? (
      <>
        <DayStepper days={days} value={view.day} onChange={(day) => update({ day })} />
        <Select
          label="Gate closure on D-1"
          hideLabel
          value={view.gate}
          options={GATE_OPTIONS}
          onChange={(gate) => update({ gate })}
        />
      </>
    ) : (
      <HorizonSlider value={view.horizon} max={meta.max_horizon_hours} onChange={(horizon) => update({ horizon })} />
    );

  return (
    <>
      <TopBar tab={view.tab} onTabChange={(tab) => update({ tab })} controls={controls} />
      <main className={s.main}>
        {view.tab === "decision" ? (
          <DecisionView deliveryDate={view.day} gateTime={view.gate} />
        ) : (
          <AccuracyView horizon={view.horizon} />
        )}
      </main>
      <footer className={s.footer}>
        Data: Elexon BMRS — FUELHH outturn (fuel type WIND) and WINDFOR forecasts, {meta.forecast_runs} forecast runs.
        All times UTC, which equals UK time in January.
      </footer>
    </>
  );
}

export default function App() {
  const meta = useQuery("meta", (signal) => api.meta(signal));
  if (meta.data) return <Dashboard meta={meta.data} />;
  return <div className={s.boot}>{meta.error ? meta.error.message : "Loading…"}</div>;
}
```

**`frontend/src/components/DecisionView.tsx`** (replace)
```tsx
import { api, errorReference } from "../api";
import { useQuery } from "../data/useQuery";
import { formatDayLong, formatHourUtc, formatWeekdayDay } from "../format";
import type { DecisionResponse } from "../types";
import { ChartLegend } from "./charts/ChartLegend";
import { DECISION_LEGEND, DecisionChart } from "./charts/DecisionChart";
import { SummaryRail } from "./decision/SummaryRail";
import s from "./DecisionView.module.css";
import { ErrorPanel } from "./feedback/ErrorPanel";
import { Skeleton } from "./feedback/Skeleton";
import { PageHeader } from "./layout/PageHeader";
import { Panel } from "./layout/Panel";

const TITLE = "Day-ahead decision";

export function decisionSummary(d: DecisionResponse): string {
  const gate = formatHourUtc(d.gate_closure);
  if (!d.forecast_published_at) return `No forecast was published before the ${gate} gate.`;
  const run = d.forecast_published_at;
  return `Forecast run ${formatHourUtc(run)} UTC on ${formatWeekdayDay(run)}, the latest before the ${gate} gate.`;
}

interface DecisionViewProps {
  deliveryDate: string;
  gateTime: string;
}

export function DecisionView({ deliveryDate, gateTime }: DecisionViewProps) {
  const decision = useQuery(`decision:${deliveryDate}:${gateTime}`, (signal) =>
    api.decision(deliveryDate, gateTime, signal),
  );
  const d = decision.data;

  if (decision.error) {
    return (
      <>
        <PageHeader title={TITLE} />
        <ErrorPanel
          message={`Couldn't load the forecast for ${formatDayLong(deliveryDate)}.`}
          reference={errorReference(decision.error)}
          onRetry={decision.reload}
        />
      </>
    );
  }

  if (!d) {
    return (
      <>
        <PageHeader title={TITLE} />
        <div className={s.layout}>
          <Skeleton height={420} />
          <div className={s.skeletonRail}>
            <Skeleton height={120} />
            <Skeleton height={200} />
          </div>
        </div>
      </>
    );
  }

  return (
    <>
      <PageHeader title={TITLE} description={decisionSummary(d)} status={decision.loading ? "Updating…" : undefined} />
      <div className={s.layout} aria-busy={decision.loading}>
        <Panel title="Wind forecast at gate closure vs outturn" legend={<ChartLegend items={DECISION_LEGEND} />}>
          <DecisionChart points={d.points} />
        </Panel>
        <SummaryRail decision={d} />
      </div>
    </>
  );
}
```

**`frontend/src/components/AccuracyView.tsx`** (replace)
```tsx
import { api, errorReference } from "../api";
import { useQuery } from "../data/useQuery";
import { formatMw, formatPct } from "../format";
import type { Metrics } from "../types";
import { type Metric, MetricStrip } from "./accuracy/MetricStrip";
import s from "./AccuracyView.module.css";
import { AccuracySeriesChart } from "./charts/AccuracySeriesChart";
import { ChartLegend, type LegendItem } from "./charts/ChartLegend";
import { chartColors } from "./charts/chartTheme";
import { ErrorHistogram } from "./charts/ErrorHistogram";
import { HorizonChart } from "./charts/HorizonChart";
import { ErrorPanel } from "./feedback/ErrorPanel";
import { Skeleton } from "./feedback/Skeleton";
import { PageHeader } from "./layout/PageHeader";
import { Panel } from "./layout/Panel";

const TITLE = "Forecast accuracy";

const SERIES_LEGEND: LegendItem[] = [
  { label: "Forecast", color: chartColors.forecast, kind: "line" },
  { label: "Outturn", color: chartColors.outturn, kind: "dashed" },
];

const HISTOGRAM_LEGEND: LegendItem[] = [
  { label: "Wind below forecast", color: chartColors.risk, kind: "bar" },
  { label: "Wind above forecast", color: chartColors.neutralBar, kind: "bar" },
];

const HORIZON_LEGEND: LegendItem[] = [
  { label: "MAE", color: chartColors.forecast, kind: "line" },
  { label: "P10–P90 error", color: chartColors.forecastRangeKey, kind: "area" },
];

const accuracyMetrics = (m: Metrics): Metric[] => [
  { label: "Mean absolute error", value: formatMw(m.mae_mw), note: `${m.n} hourly samples` },
  { label: "RMSE", value: formatMw(m.rmse_mw), note: "Penalises large misses" },
  { label: "Bias", value: formatMw(m.bias_mw), note: "Positive: forecast above outturn" },
  { label: "WAPE", value: formatPct(m.wape_pct), note: "Absolute error as % of outturn" },
  { label: "P90 absolute error", value: formatMw(m.p90_abs_mw), note: "9 in 10 hours miss by less" },
];

export function AccuracyView({ horizon }: { horizon: number }) {
  const accuracy = useQuery(`accuracy:${horizon}`, (signal) => api.accuracy(horizon, signal));
  const profile = useQuery("accuracy-by-horizon", (signal) => api.byHorizon(signal));
  const a = accuracy.data;
  const description = `Forecast available at least ${horizon} h before each hour, January 2026 delivery.`;

  if (accuracy.error) {
    return (
      <>
        <PageHeader title={TITLE} />
        <ErrorPanel
          message={`Couldn't load accuracy for the ${horizon} h horizon.`}
          reference={errorReference(accuracy.error)}
          onRetry={accuracy.reload}
        />
      </>
    );
  }

  if (!a) {
    return (
      <>
        <PageHeader title={TITLE} description={description} />
        <div className={s.content}>
          <Skeleton height={96} />
          <Skeleton height={360} />
        </div>
      </>
    );
  }

  return (
    <>
      <PageHeader title={TITLE} description={description} status={accuracy.loading ? "Updating…" : undefined} />
      <div className={s.content} aria-busy={accuracy.loading}>
        <MetricStrip metrics={accuracyMetrics(a.metrics)} />
        <Panel title="Actual vs forecast" legend={<ChartLegend items={SERIES_LEGEND} />}>
          <AccuracySeriesChart points={a.points} />
        </Panel>
        <div className={s.row}>
          <Panel
            title="Error distribution"
            subtitle="Forecast minus outturn, hourly"
            legend={<ChartLegend items={HISTOGRAM_LEGEND} />}
          >
            <ErrorHistogram bins={a.histogram} />
          </Panel>
          <Panel
            title="How error grows with lead time"
            subtitle="By hours ahead of delivery"
            legend={<ChartLegend items={HORIZON_LEGEND} />}
          >
            {profile.data ? <HorizonChart rows={profile.data} selected={horizon} /> : <Skeleton height={260} />}
          </Panel>
        </div>
      </div>
    </>
  );
}
```

Delete the old hook:
```bash
git rm frontend/src/useAsync.ts
```

Run: `cd frontend && npm run lint && npm run typecheck && npm test && npm run build`
Expected: all pass.

- [ ] **Step 4: Commit, PR, merge, deploy**

```bash
git add -A frontend/src
git commit -m "feat(ui): shareable URL state, cached and cancellable queries, request ids in error messages"
git push -u origin HEAD && gh pr create --fill
```
After CI passes:
```bash
gh pr merge --merge --delete-branch && git checkout main && git pull && npx vercel deploy --prod --yes
```
Check live:
- `https://4eaez3.vercel.app/?tab=accuracy&h=6` opens the accuracy tab at 6 h.
- Stepping days updates the URL.
- Going back to a day you've already viewed is instant, with no "Updating…".

---

### Task 6: Performance and resilience — debounced slider, memoised charts, keyboard, error boundary, edge cases

**Files:**
- Create:
  - Hooks: `frontend/src/hooks/useDebouncedValue.ts`, `frontend/src/hooks/useDebouncedValue.test.ts`, `frontend/src/hooks/useArrowKeys.ts`, `frontend/src/hooks/useArrowKeys.test.tsx`
  - Error boundary: `frontend/src/components/feedback/ErrorBoundary.tsx`, `frontend/src/components/feedback/ErrorBoundary.module.css`, `frontend/src/components/feedback/ErrorBoundary.test.tsx`
  - Edge-case tests: `frontend/src/components/charts/DecisionChart.test.tsx`, `backend/tests/test_edge_cases.py`
- Modify:
  - Frontend: `frontend/src/App.tsx`, `frontend/src/components/AccuracyView.tsx`, `frontend/src/components/AccuracyView.test.tsx`, `frontend/src/App.test.tsx`, the four chart files (`memo` + `useMemo`), `frontend/src/components/decision/SummaryRail.tsx`, `frontend/src/components/DecisionView.test.tsx`
  - Backend: `backend/app/analytics.py`

**Interfaces:**
- Consumes: `useQuery`, `useViewState`, `api` (Task 5).
- Produces:
  - `useDebouncedValue<T>(value: T, delayMs: number): T`
  - `useArrowKeys(onPrev: () => void, onNext: () => void, enabled: boolean): void`
  - `ErrorBoundary({ children })`
  - `decision_view` returns `forecast_energy_mwh: None` when there are no forecast points.

- [ ] **Step 1: Branch**

```bash
git checkout main && git pull && git checkout -b improve/6-performance-and-edge-cases
```

- [ ] **Step 2: Write the failing tests**

**`frontend/src/hooks/useDebouncedValue.test.ts`** (create)
```ts
import { act, renderHook } from "@testing-library/react";
import { useDebouncedValue } from "./useDebouncedValue";

beforeEach(() => vi.useFakeTimers());
afterEach(() => vi.useRealTimers());

describe("useDebouncedValue", () => {
  it("updates only after the value stops changing", () => {
    const { result, rerender } = renderHook(({ v }) => useDebouncedValue(v, 150), { initialProps: { v: 1 } });
    rerender({ v: 2 });
    rerender({ v: 3 });
    act(() => vi.advanceTimersByTime(149));
    expect(result.current).toBe(1);
    act(() => vi.advanceTimersByTime(1));
    expect(result.current).toBe(3);
  });
});
```

**`frontend/src/hooks/useArrowKeys.test.tsx`** (create)
```tsx
import { fireEvent, render } from "@testing-library/react";
import { useArrowKeys } from "./useArrowKeys";

function Harness({ onPrev, onNext, enabled }: { onPrev: () => void; onNext: () => void; enabled: boolean }) {
  useArrowKeys(onPrev, onNext, enabled);
  return <input aria-label="field" />;
}

describe("useArrowKeys", () => {
  it("calls prev and next for the arrow keys", () => {
    const onPrev = vi.fn();
    const onNext = vi.fn();
    render(<Harness onPrev={onPrev} onNext={onNext} enabled />);
    fireEvent.keyDown(window, { key: "ArrowRight" });
    fireEvent.keyDown(window, { key: "ArrowLeft" });
    expect(onNext).toHaveBeenCalledTimes(1);
    expect(onPrev).toHaveBeenCalledTimes(1);
  });

  it("ignores keys typed into form fields, with modifiers, or when disabled", () => {
    const onNext = vi.fn();
    const { getByLabelText, rerender } = render(<Harness onPrev={vi.fn()} onNext={onNext} enabled />);
    fireEvent.keyDown(getByLabelText("field"), { key: "ArrowRight" });
    fireEvent.keyDown(window, { key: "ArrowRight", altKey: true });
    rerender(<Harness onPrev={vi.fn()} onNext={onNext} enabled={false} />);
    fireEvent.keyDown(window, { key: "ArrowRight" });
    expect(onNext).not.toHaveBeenCalled();
  });
});
```

**`frontend/src/components/feedback/ErrorBoundary.test.tsx`** (create)
```tsx
import { render, screen } from "@testing-library/react";
import { ErrorBoundary } from "./ErrorBoundary";

function Broken(): JSX.Element {
  throw new Error("render failed");
}

describe("ErrorBoundary", () => {
  it("replaces a crashed subtree with a recoverable message", () => {
    const consoleError = vi.spyOn(console, "error").mockImplementation(() => {});
    render(
      <ErrorBoundary>
        <Broken />
      </ErrorBoundary>,
    );
    expect(screen.getByText("Something went wrong on this page.")).toBeInTheDocument();
    expect(screen.getByRole("button", { name: "Reload" })).toBeInTheDocument();
    consoleError.mockRestore();
  });
});
```

**`frontend/src/components/charts/DecisionChart.test.tsx`** (create)
```tsx
import { render } from "@testing-library/react";
import { DecisionChart } from "./DecisionChart";

it("renders without data", () => {
  expect(() => render(<DecisionChart points={[]} />)).not.toThrow();
});
```

**`frontend/src/components/DecisionView.test.tsx`** — append this test inside the `describe` block:
```tsx
  it("says so when no forecast exists for the day", async () => {
    vi.mocked(api.decision).mockResolvedValue({
      ...decisionFixture,
      points: [],
      forecast_published_at: null,
      forecast_energy_mwh: null,
      actual_energy_mwh: null,
    });
    render(<DecisionView deliveryDate="2026-01-02" gateTime="09:20" />);
    expect(await screen.findByText("No forecast was published for this day before the gate.")).toBeInTheDocument();
    expect(screen.getByText(/No forecast was published before the 09:20 gate/)).toBeInTheDocument();
  });
```

**`frontend/src/components/AccuracyView.test.tsx`** — make two changes:
- Add `waitFor` to the testing-library import.
- In "keeps results and shows updating while a new horizon loads", add this line after the `findByText("Updating…")` assertion:
  ```tsx
  await waitFor(() => expect(api.accuracy).toHaveBeenLastCalledWith(6, anySignal));
  ```

**`frontend/src/App.test.tsx`** — append:
```tsx
it("steps days with the arrow keys", async () => {
  render(<App />);
  await screen.findByText("Shortfall at risk (P10)");
  fireEvent.keyDown(window, { key: "ArrowRight" });
  expect(api.decision).toHaveBeenLastCalledWith("2026-01-03", "09:20", anySignal);
});
```

**`backend/tests/test_edge_cases.py`** (create)
```python
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
```

Run:
```bash
cd backend && .venv/Scripts/python -m pytest tests/test_edge_cases.py -q
cd ../frontend && npm test
```
Expected:
- Backend: `test_day_without_any_forecast_returns_an_empty_view` fails (it gets `0.0`, expects `None`). The other backend tests pass.
- Frontend: the hook and boundary tests fail because their modules don't exist. The no-forecast DecisionView test and the arrow-key App test also fail.

- [ ] **Step 3: Implement**

**`frontend/src/hooks/useDebouncedValue.ts`** (create)
```ts
import { useEffect, useState } from "react";

export function useDebouncedValue<T>(value: T, delayMs: number): T {
  const [debounced, setDebounced] = useState(value);
  useEffect(() => {
    const id = setTimeout(() => setDebounced(value), delayMs);
    return () => clearTimeout(id);
  }, [value, delayMs]);
  return debounced;
}
```

**`frontend/src/hooks/useArrowKeys.ts`** (create)
```ts
import { useEffect } from "react";

const FORM_FIELDS = new Set(["INPUT", "SELECT", "TEXTAREA"]);

/** ←/→ anywhere on the page, except while typing in a form field. */
export function useArrowKeys(onPrev: () => void, onNext: () => void, enabled: boolean): void {
  useEffect(() => {
    if (!enabled) return;
    const onKey = (e: KeyboardEvent) => {
      const target = e.target as HTMLElement | null;
      if ((target && FORM_FIELDS.has(target.tagName)) || e.altKey || e.ctrlKey || e.metaKey) return;
      if (e.key === "ArrowLeft") onPrev();
      else if (e.key === "ArrowRight") onNext();
    };
    window.addEventListener("keydown", onKey);
    return () => window.removeEventListener("keydown", onKey);
  }, [onPrev, onNext, enabled]);
}
```

**`frontend/src/components/feedback/ErrorBoundary.tsx`** (create)
```tsx
import { Component, type ErrorInfo, type ReactNode } from "react";
import s from "./ErrorBoundary.module.css";

interface State {
  error: Error | null;
}

/** Keeps a rendering bug in one view from blanking the whole app. */
export class ErrorBoundary extends Component<{ children: ReactNode }, State> {
  state: State = { error: null };

  static getDerivedStateFromError(error: Error): State {
    return { error };
  }

  componentDidCatch(error: Error, info: ErrorInfo) {
    console.error("Unhandled UI error", error, info.componentStack);
  }

  render() {
    if (!this.state.error) return this.props.children;
    return (
      <div className={s.boundary} role="alert">
        <h2 className={s.title}>Something went wrong on this page.</h2>
        <p>Reload to try again. If it keeps happening, the details are in the browser console.</p>
        <button type="button" className={s.reload} onClick={() => window.location.reload()}>
          Reload
        </button>
      </div>
    );
  }
}
```

**`frontend/src/components/feedback/ErrorBoundary.module.css`** (create)
```css
.boundary {
  display: flex;
  flex-direction: column;
  align-items: flex-start;
  gap: var(--space-3);
  padding: var(--space-6);
  border: 1px solid var(--border);
  border-radius: var(--radius-panel);
  color: var(--text-2);
}
.title {
  font-size: var(--text-lg);
  color: var(--text);
}
.reload {
  height: 34px;
  padding: 0 var(--space-4);
  border: 1px solid var(--border-strong);
  border-radius: var(--radius-control);
  background: var(--bg);
  cursor: pointer;
}
```

**`frontend/src/App.tsx`** — edits:
- Change the first import to `import { useCallback, useMemo } from "react";`.
- Add the imports `import { ErrorBoundary } from "./components/feedback/ErrorBoundary";` and `import { useArrowKeys } from "./hooks/useArrowKeys";`.
- Insert these lines directly after `const [view, update] = useViewState(limits);`:
```tsx
  const dayIndex = days.indexOf(view.day);
  const stepDay = useCallback(
    (delta: number) => {
      const next = days[dayIndex + delta];
      if (next) update({ day: next });
    },
    [days, dayIndex, update],
  );
  const previousDay = useCallback(() => stepDay(-1), [stepDay]);
  const nextDay = useCallback(() => stepDay(1), [stepDay]);
  useArrowKeys(previousDay, nextDay, view.tab === "decision");
```
- Wrap the content of `<main className={s.main}>` in `<ErrorBoundary>…</ErrorBoundary>`.

**`frontend/src/components/AccuracyView.tsx`** — edits:
- Add `import { useDebouncedValue } from "../hooks/useDebouncedValue";`.
- Replace the first lines of the component body:
```tsx
export function AccuracyView({ horizon }: { horizon: number }) {
  // The slider moves every frame; only fetch once the user pauses.
  const requested = useDebouncedValue(horizon, 150);
  const accuracy = useQuery(`accuracy:${requested}`, (signal) => api.accuracy(requested, signal));
  const profile = useQuery("accuracy-by-horizon", (signal) => api.byHorizon(signal));
  const a = accuracy.data;
  const updating = accuracy.loading || requested !== horizon;
  const description = `Forecast available at least ${requested} h before each hour, January 2026 delivery.`;
```
- In the error branch, use `requested` instead of `horizon` in the message.
- In the main return, replace `status={accuracy.loading ? "Updating…" : undefined}` with `status={updating ? "Updating…" : undefined}`.
- Replace `aria-busy={accuracy.loading}` with `aria-busy={updating}`.
- Keep `<HorizonChart rows={profile.data} selected={horizon} />`. The marker follows the slider immediately because that data is already loaded.

**Chart memoisation.** The goal is that the 744-point series chart doesn't re-render while the slider moves or other state changes.

**`frontend/src/components/charts/DecisionChart.tsx`** — edits:
- Change the recharts-independent import line to `import { memo, useMemo } from "react";`.
- Rename `export function DecisionChart(` to `function DecisionChartView(`.
- Wrap the derived values:
```tsx
  const rows = useMemo(() => toDecisionRows(points), [points]);
  const yTicks = useMemo(
    () => niceTicks(0, Math.max(0, ...points.flatMap((p) => [p.forecast_mw, p.actual_mw ?? 0, p.high_mw ?? 0]))),
    [points],
  );
  const xTicks = useMemo(() => rows.filter((_, i) => i % 3 === 0).map((r) => r.time), [rows]);
```
  These replace the existing `rows`, `max`, `yTicks` and `xTicks` lines.
- Add at the end of the file: `export const DecisionChart = memo(DecisionChartView);`

**`frontend/src/components/charts/AccuracySeriesChart.tsx`** — edits:
- Add `import { memo, useMemo } from "react";`.
- Rename `export function AccuracySeriesChart(` to `function AccuracySeriesChartView(`.
- Wrap the derived values:
```tsx
  const rows = useMemo<SeriesRow[]>(
    () => points.map((p) => ({ startTime: p.start_time, forecast: p.forecast_mw, actual: p.actual_mw, error: p.error_mw })),
    [points],
  );
  const yTicks = useMemo(
    () => niceTicks(0, Math.max(0, ...points.flatMap((p) => [p.forecast_mw, p.actual_mw ?? 0]))),
    [points],
  );
  const xTicks = useMemo(() => weeklyTicks(rows.map((r) => r.startTime)), [rows]);
```
  These replace the existing `rows`, `max` and `yTicks` lines. Change the XAxis to `ticks={xTicks}`.
- Add at the end: `export const AccuracySeriesChart = memo(AccuracySeriesChartView);`

**`frontend/src/components/charts/ErrorHistogram.tsx`** — edits:
- Add `import { memo, useMemo } from "react";`.
- Rename `export function ErrorHistogram(` to `function ErrorHistogramView(`.
- Wrap `rows` and `xTicks` in `useMemo(..., [bins])` and `useMemo(..., [rows])`.
- Add at the end: `export const ErrorHistogram = memo(ErrorHistogramView);`

**`frontend/src/components/charts/HorizonChart.tsx`** — edits:
- Add `import { memo, useMemo } from "react";`.
- Rename `export function HorizonChart(` to `function HorizonChartView(`.
- Wrap `data` and `yTicks` in `useMemo(..., [rows])`.
- Add at the end: `export const HorizonChart = memo(HorizonChartView);`

**`frontend/src/components/decision/SummaryRail.tsx`** — replace the opening risk block:
```tsx
      {atRisk == null ? (
        <p className={s.noRange}>Not enough history yet for a likely range.</p>
      ) : (
```
with:
```tsx
      {d.points.length === 0 ? (
        <p className={s.noRange}>No forecast was published for this day before the gate.</p>
      ) : atRisk == null ? (
        <p className={s.noRange}>Not enough history yet for a likely range.</p>
      ) : (
```

**`backend/app/analytics.py`** — in `decision_view`, replace
```python
        "forecast_energy_mwh": _r(joined["forecast_mw"].sum()),
```
with
```python
        "forecast_energy_mwh": _r(joined["forecast_mw"].sum()) if len(joined) else None,
```

Run:
```bash
cd backend && .venv/Scripts/python -m pytest -q --cov=app --cov-fail-under=95 && .venv/Scripts/python -m ruff format . ../api && .venv/Scripts/python -m ruff check . ../api
cd ../frontend && npm run lint && npm run typecheck && npm test && npm run build
```
Expected: everything passes.

- [ ] **Step 4: Commit, PR, merge, deploy**

```bash
git add -A backend frontend/src
git commit -m "feat(ui): debounce horizon fetches, memoise charts, arrow-key day stepping, error boundary; cover edge cases"
git push -u origin HEAD && gh pr create --fill
```
After CI passes:
```bash
gh pr merge --merge --delete-branch && git checkout main && git pull && npx vercel deploy --prod --yes
```
Check live:
- Dragging the slider sends one request after you stop, not one per tick (check the browser network panel).
- ←/→ step days.

---

### Task 7: Documentation that sounds like an engineer — README, decision records, contributing guide

**Files:**
- Replace: `README.md`, `docs/demo-script.md`
- Create:
  - `docs/decisions/0001-scope-january-decisions.md`
  - `docs/decisions/0002-gate-closure-0920.md`
  - `docs/decisions/0003-committed-snapshot.md`
  - `docs/decisions/0004-hourly-alignment.md`
  - `docs/decisions/0005-error-band-method.md`
  - `docs/decisions/0006-vercel-and-docker.md`
  - `docs/decisions/0007-api-versioning-and-errors.md`
  - `CONTRIBUTING.md`, `.github/pull_request_template.md`, `docs/archive/ai-planning/README.md`
- Move: `docs/superpowers/` → `docs/archive/ai-planning/`

**Interfaces:**
- Consumes: everything above, for accurate commands and paths.
- Produces: documentation only.

- [ ] **Step 1: Branch and move the AI planning docs**

```bash
git checkout main && git pull && git checkout -b improve/7-docs
git mv docs/superpowers docs/archive/ai-planning
```

**`docs/archive/ai-planning/README.md`** (create)
```markdown
# AI planning documents

These are the plans and design specs I wrote with Claude Code while building GridBrick, kept for transparency. They describe the work as it was planned at the time; where the code differs, the code and the decision records in `docs/decisions/` are current.
```

- [ ] **Step 2: Write the decision records**

**`docs/decisions/0001-scope-january-decisions.md`** (create)
```markdown
# 1. "Decisions made in January 2026" means delivery 2 Jan – 1 Feb

## Context
The brief asks for data "relevant only for purchase decisions to be made in January 2026". Day-ahead purchases happen the day before delivery, so the decision date and the delivery date are a day apart.

## Decision
A decision on day D-1 in January buys power for day D. The delivery window is 2026-01-02 to 2026-02-01 (31 days, 744 hours). I also load forecasts from 23 Dec and actuals from 25 Dec, but only so early-January decisions have recent errors to build a likely range from.

## Consequences
1 Jan is not a delivery day here and 1 Feb is. The lead-in data never shows up in headline metrics.
```

**`docs/decisions/0002-gate-closure-0920.md`** (create)
```markdown
# 2. Default gate closure is 09:20, not 11:00

## Context
My first version used 11:00 UK time, the gate closure most write-ups mention. While reviewing, I checked it: 11:00 was the coupled European auction time before Brexit. Since January 2021 the GB day-ahead auctions close at 09:20 (EPEX 60-minute) and 09:50 (N2EX), with an EPEX 30-minute auction at 15:30.

## Decision
Default to 09:20 and let the user switch between the three auctions. Gate closure is an `HH:MM` time, not a whole hour.

## Consequences
The "latest forecast before the gate" changes. At 09:20 the 09:30 WINDFOR run isn't available yet, so the app picks the 07:30 run. Times are UK local, which equals UTC in January; I don't model the hour or so a trader needs to prepare bids.
```

**`docs/decisions/0003-committed-snapshot.md`** (create)
```markdown
# 3. Serve a committed snapshot instead of calling Elexon at runtime

## Context
January 2026 is history, so the data won't change. The whole window is small: about 1.9k half-hourly actuals and 24k forecast rows.

## Decision
`backend/scripts/snapshot.py` downloads the window once into `backend/data/*.csv.gz`, which is committed. The app reads the snapshot and only fetches live from Elexon if the files are missing.

## Consequences
Results are reproducible, the demo works when Elexon is down, and responses can be cached aggressively (see decision 7). Refreshing data is a deliberate step, not a side effect of traffic.
```

**`docs/decisions/0004-hourly-alignment.md`** (create)
```markdown
# 4. Compare forecasts and actuals hourly

## Context
WINDFOR forecasts are hourly; FUELHH actuals are half-hourly.

## Decision
Compare on WINDFOR's hourly target times, matching each forecast to the half-hour period that starts on the hour.

## Consequences
Simple and transparent. Averaging both half-hours instead would change the 24 h MAE by about 16 MW (1932 vs 1948 MW), which doesn't change any conclusion.
```

**`docs/decisions/0005-error-band-method.md`** (create)
```markdown
# 5. Likely range from recent errors at each hour's own lead time

## Context
A buyer needs a range, not just a number. The range must only use information available at gate closure, or it will look better than it really is.

## Decision
For each delivery hour, take signed errors from the previous 14 days at that hour's lead time from gate closure, using only actuals published before the gate. Report P10–P90. Hide the range when fewer than 48 samples exist.

My first version used one lead time (13 h) for the whole day. A calibration check showed outturn fell inside the range 77% of the time against 80% nominal, so I switched to per-hour lead times.

## Consequences
Coverage over January is 78.0% inside, 15.3% below P10 and 6.7% above P90 (`python -m scripts.calibration`). The range is still too narrow on the downside, so "shortfall at risk" should be read as a lower bound. The obvious next step is a longer or bias-adjusted window.
```

**`docs/decisions/0006-vercel-and-docker.md`** (create)
```markdown
# 6. Deploy on Vercel; keep Docker for local runs

## Context
The brief asks for Docker and a Vercel or Heroku deployment. Heroku no longer has a free tier.

## Decision
Vercel serves the React build from its CDN and runs the same FastAPI app as a Python function (`api/index.py`). The Dockerfile builds one image with both, used for local runs and smoke-tested in CI.

## Consequences
Free hosting and fast static delivery. Two deployment shapes have to stay in sync, so CI builds the Docker image and hits it on every change.
```

**`docs/decisions/0007-api-versioning-and-errors.md`** (create)
```markdown
# 7. Version the API and use one error shape

## Context
The first API used unversioned paths and two error formats: FastAPI's default `{"detail": ...}` for my own errors and a list of validation errors for bad parameters. Clients had to handle both, and any change would break them.

## Decision
- Serve everything under `/api/v1`. Keep `/api/*` as a hidden, deprecated alias so old links keep working.
- Every error is `{"error": {"code", "message", "request_id", "details"}}`, with stable codes such as `out_of_window` and `invalid_request`.
- Successful reads are cacheable (`public, max-age=300, s-maxage=86400`) because the data is a fixed snapshot.
- Every response has an `X-Request-ID`, which also appears in error bodies, the UI's error message and the logs.

## Consequences
Breaking changes can go into `/api/v2` without breaking v1 clients. The frontend types are generated from the OpenAPI schema, and CI fails if they drift.
```

- [ ] **Step 3: Contributor guide and PR template**

**`CONTRIBUTING.md`** (create)
````markdown
# Working on GridBrick

## Setup

```bash
cd backend && python -m venv .venv && source .venv/Scripts/activate  # .venv/bin/activate on macOS/Linux
pip install -r requirements-dev.txt
cd ../frontend && npm install
```

## Workflow

1. Branch from `main` (`improve/…`, `fix/…`).
2. Keep commits small and use conventional messages (`feat(api): …`, `fix(ui): …`, `docs: …`).
3. Open a pull request. CI must pass: lint, type-check, tests with a 95% backend coverage gate, the API-contract check and a Docker smoke test.
4. Merge with a merge commit so the history shows each change.

## Before you push

```bash
cd backend && ruff check . ../api && ruff format --check . ../api && pytest --cov=app
cd frontend && npm run lint && npm run typecheck && npm test
```

## Changing the API

1. Edit `backend/app/schemas.py` and `backend/app/routes.py`. New fields are fine in v1; removing or renaming one needs `/api/v2`.
2. Regenerate the contract: `python -m scripts.export_openapi` (in `backend/`), then `npm run gen:api` (in `frontend/`).
3. Commit `frontend/openapi.json` and `frontend/src/schema.d.ts` with your change.

## Refreshing the data

`python -m scripts.snapshot` (in `backend/`) re-downloads the window from Elexon. `python -m scripts.calibration` re-checks the likely range.

## Reviewing

- Does the change keep "only information available at gate closure" true?
- Are edge cases tested: empty days, window boundaries, missing actuals?
- Is a decision worth a record in `docs/decisions/`?
````

**`.github/pull_request_template.md`** (create)
```markdown
## What and why

## How I tested it

## Checklist
- [ ] Tests added or updated
- [ ] `ruff check`, `npm run lint` and `npm run typecheck` pass
- [ ] API contract regenerated if schemas changed
- [ ] README or `docs/decisions/` updated if behaviour changed
```

- [ ] **Step 4: Rewrite the README**

**`README.md`** (replace)
````markdown
# GridBrick

[![CI](https://github.com/prajwal483/4eaez3/actions/workflows/ci.yml/badge.svg)](https://github.com/prajwal483/4eaez3/actions/workflows/ci.yml)

**Live app:** https://4eaez3.vercel.app

A UK utility's day-ahead desk buys power the day before delivery. However much wind the forecast promises at that moment, they don't have to buy from thermal plants, so the forecast they see at the auction deadline drives real money. I built GridBrick to answer two questions for January 2026:

1. **What did the wind forecast say when we had to commit?**
2. **How far can we trust it?**

The *Day-ahead decision* page shows the latest national wind forecast published before the auction gate, a likely range around it, and the extra energy the desk might need if wind comes in at the low end. The *Forecast accuracy* page shows how wrong the forecast has been, and how that changes with lead time.

## What I found

| Lead time | MAE | Bias (forecast − outturn) | WAPE |
|---|---|---|---|
| 0 h | 1.68 GW | +1.48 GW | 14.9% |
| 24 h | 1.93 GW | +1.74 GW | 17.1% |
| 48 h | 2.30 GW | +1.80 GW | 20.5% |

- Error grows with lead time, as you'd expect, but the bigger story is the bias. WINDFOR sits 1.5–1.8 GW above metered outturn even at 0 h, where it's high in about nine hours out of ten. That looks less like forecasting skill and more like a gap between the datasets: curtailment and coverage differences are my best guesses. I'd want to confirm that before anyone "corrects" for it.
- The likely range covers 78% of hours against an 80% target, and misses on the downside more than the upside. So I present "shortfall at risk" as a lower bound, not a guarantee.

## Decisions worth knowing about

The brief left a few things open. These are the calls I made; each has a short record in [`docs/decisions/`](docs/decisions/).

- **Scope.** "Decisions in January" means delivery from 2 Jan to 1 Feb. ([0001](docs/decisions/0001-scope-january-decisions.md))
- **Gate closure.** The default is 09:20, not 11:00. I started with 11:00, then found it's the pre-Brexit time. ([0002](docs/decisions/0002-gate-closure-0920.md))
- **Data.** A committed snapshot, not live calls, so results are reproducible and the demo can't be broken by Elexon downtime. ([0003](docs/decisions/0003-committed-snapshot.md))
- **Alignment.** Hourly comparisons, because that's WINDFOR's resolution. ([0004](docs/decisions/0004-hourly-alignment.md))
- **Likely range.** It uses only information available at the gate, at each hour's own lead time, and is checked for calibration. ([0005](docs/decisions/0005-error-band-method.md))
- **Hosting.** Vercel for free hosting; Docker for local runs, smoke-tested in CI. ([0006](docs/decisions/0006-vercel-and-docker.md))
- **API.** Versioned under `/api/v1`, with one error shape and request ids. ([0007](docs/decisions/0007-api-versioning-and-errors.md))

## How it fits together

```
Elexon BMRS (FUELHH wind, WINDFOR) ──► backend/data snapshot
                                            │
                       backend/app/analytics.py   pure pandas functions, no I/O
                                            │
                       backend/app/routes.py      FastAPI /api/v1, typed schemas, one error shape
                                            │  OpenAPI ──► generated TypeScript types
                       frontend/src               React + Recharts
```

- **Backend.** The analysis lives in pure functions, so it's tested directly against a synthetic dataset where the error is exactly 10 MW per hour of lead time. Every expected value in the tests can be worked out by hand. Routes stay thin: validate input, call analytics, return a schema.
- **Frontend.**
  - View state lives in the URL, so links are shareable and a refresh keeps your place.
  - Data goes through a small query cache that cancels stale requests, so revisiting a day is instant.
  - The horizon slider only fetches when you pause.
  - Charts are memoised, so the 744-point series doesn't redraw on every tick.

## Running it

With Docker:

```bash
docker compose up --build
```

Then open http://localhost:8000.

For development (Python 3.12+, Node 20+):

```bash
cd backend && python -m venv .venv && source .venv/Scripts/activate && pip install -r requirements-dev.txt
uvicorn app.main:app --reload --port 8000
```

```bash
cd frontend && npm install && npm run dev
```

The dev server runs on http://localhost:5173 and proxies `/api` to port 8000.

## Checks

Every push and pull request runs [CI](.github/workflows/ci.yml):

- **Backend:** ruff, and pytest with a 95% coverage gate.
- **Frontend:** ESLint, type-check, Vitest and a production build.
- **API contract:** fails if the TypeScript types are out of date with the API.
- **Docker:** builds the image and calls it.

To run the same checks locally:

```bash
cd backend && ruff check . && pytest --cov=app
```

```bash
cd frontend && npm run lint && npm run typecheck && npm test
```

[CONTRIBUTING.md](CONTRIBUTING.md) covers the workflow, changing the API, and refreshing the data.

## Project layout

```
backend/
  app/            config, Elexon client, snapshot store, analytics, schemas, routes, errors, logging
  data/           committed January 2026 snapshot
  scripts/        snapshot refresh, calibration check, OpenAPI export
  tests/          unit, API, contract, observability and edge-case tests
frontend/
  src/components/ page views and their parts: layout, controls, charts, decision, accuracy, feedback
  src/data/       query cache;  src/state/  URL view state;  src/hooks/  debounce, keyboard
  src/styles/     design tokens and base styles
  openapi.json    API contract the TypeScript types are generated from
api/index.py      Vercel entrypoint for the FastAPI app
docs/decisions/   decision records;  docs/archive/  earlier planning documents
Dockerfile, docker-compose.yml, vercel.json
```

## API

Interactive docs are at `/docs` when running locally.

| Endpoint | What it returns |
|---|---|
| `GET /api/v1/decision?delivery_date=2026-01-15&gate_time=09:20` | The forecast at gate closure, the likely range, outturn and metrics |
| `GET /api/v1/accuracy?horizon=24` | Hourly forecast and outturn pairs, metrics and error histogram |
| `GET /api/v1/accuracy/by-horizon` | Metrics for every 3 h horizon from 0 to 48 h |
| `GET /api/v1/meta` | Delivery window and defaults |
| `GET /api/v1/health` | Liveness and the loaded dataset |

- **Errors** always look like `{"error": {"code": "out_of_window", "message": "...", "request_id": "..."}}`.
- **Request ids:** every response carries an `X-Request-ID`, which also appears in the JSON logs.

## What I'd do next

- Check the forecast–outturn gap against curtailment data before offering any bias correction.
- Widen or bias-adjust the error window until the range is properly calibrated.
- Add other renewables and the demand forecast, so the page shows the residual the desk actually has to buy.
- Move from the snapshot to a scheduled ingest once this needs live data.

## How I used AI

I used Claude Code (Anthropic) throughout: for planning, writing code and tests, and reviewing. I directed the work, made the product and analysis decisions described above, and checked the results against the live data. The planning documents from that process are in [`docs/archive/ai-planning/`](docs/archive/ai-planning/).
````

**Before committing, the user must confirm that the "How I used AI" paragraph accurately describes their own involvement, and edit it if not.**

- [ ] **Step 5: Update the demo script's tech section**

**`docs/demo-script.md`** (replace)
```markdown
# Demo video script (≤ 10 min)

## Part 1 — Client pitch (≤ 5 min)
1. (0:30) The problem: day-ahead bids lock in at 09:20 on D-1 (EPEX GB auction; N2EX at 09:50), and wind is the biggest swing in what still needs buying.
2. (1:30) Day-ahead decision page:
   - Step through January with the arrows.
   - Show the forecast that was actually available at the gate, the likely range, and the shortfall at risk.
   - Contrast a windy day with a calm one.
   - 2 Jan is a good example: outturn fell below the whole range.
3. (1:30) Forecast accuracy page:
   - MAE about 1.9 GW and WAPE about 17% at 24 h.
   - Forecasts run 1.5–1.8 GW above metered outturn even at 0 h. Present this as a forecast-versus-outturn gap that likely includes curtailment, not just forecast error.
   - Drag the slider: error grows from 1.7 to 2.3 GW across 0–48 h.
4. (1:00) Value and next steps:
   - Size hedges from the P10 shortfall, treated as a lower bound (78% coverage against 80%).
   - Check the gap against curtailment before correcting for bias.
   - Then add other renewables and demand.

## Part 2 — Tech lead review (≤ 5 min)
1. (1:00) Architecture:
   - Snapshot, then pure pandas analytics, then a thin FastAPI `/api/v1`, then React.
   - Show the README diagram and the decision records.
2. (1:15) Analysis design:
   - How horizon is defined.
   - The no-look-ahead likely range at each hour's lead time.
   - The calibration check, and why the gate is 09:20 (decision 0002).
3. (1:30) Code walkthrough:
   - `analytics.py` and its synthetic-data tests.
   - `routes.py`: `Depends`, the error envelope, cache headers.
   - `observability.py`: request ids and JSON logs.
   - Frontend `useQuery` (cache and cancellation), `useViewState` (URL), and memoised charts.
4. (1:15) Practices:
   - CI pipeline: lint, types, coverage gate, API-contract drift check, Docker smoke test.
   - PR-per-change history and conventional commits.
   - Disclosed AI use.
   - What I'd do next.
```

- [ ] **Step 6: Check required README items, commit, PR, merge**

Run:
```bash
grep -nE "Live app|Running it|Project layout|How I used AI" README.md
grep -rn "docs/superpowers" README.md CONTRIBUTING.md docs/decisions docs/demo-script.md || echo "no stale links"
```
Expected: all four headings or lines are found, and the second command prints `no stale links`.

```bash
git add -A README.md CONTRIBUTING.md .github docs
git commit -m "docs: rewrite README, add decision records and contributing guide, archive AI planning docs"
git push -u origin HEAD && gh pr create --fill
```
After CI passes:
```bash
gh pr merge --merge --delete-branch && git checkout main && git pull
```
Open https://github.com/prajwal483/4eaez3 in an incognito window. Check that the README renders, the CI badge is green, and the decision-record links work.
