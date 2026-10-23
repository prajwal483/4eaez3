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

I used Claude Code for the bulk of the hands-on work: writing code, tests and docs. I set the direction, made the product and analysis calls described above, and reviewed what it produced.
