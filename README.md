# GridBrick · Wind Forecast Monitor

A pilot web app for a UK utility's day-ahead power buying team. It answers two questions for January 2026 delivery:

1. **What wind forecast was available when we had to buy?** For each delivery day the app shows the latest GB national wind forecast published before day-ahead gate closure (default 11:00 UTC on D-1). Around that forecast it shows an empirical P10–P90 range and the "shortfall at risk": the energy to cover if wind lands at its P10.
2. **How much can we trust it?** It reports MAE, RMSE, bias, WAPE and P90 absolute error for any forecast lead time from 0 to 48 h, plus the error distribution and how error grows with lead time.

**Live app:** https://4eaez3.vercel.app

## Key findings (January 2026 delivery, 744 hours)

| Lead time | MAE | Bias (forecast − actual) | WAPE |
|---|---|---|---|
| 0 h | 1.68 GW | +1.48 GW | 14.9% |
| 24 h | 1.93 GW | +1.74 GW | 17.1% |
| 48 h | 2.30 GW | +1.80 GW | 20.5% |

- Forecasts get less accurate the further ahead they look, but most of the error is a **systematic over-forecast** of about 1.5–1.8 GW. A buyer who takes the forecast at face value will tend to under-buy.
- Day-ahead decisions (13–37 h ahead) carry a P10–P90 error band roughly 4 GW wide. The app turns this into a per-day "shortfall at risk" figure.

## Data

- Actuals: Elexon BMRS `FUELHH`, `fuelType = WIND`, half-hourly `generation` (MW).
- Forecasts: Elexon BMRS `WINDFOR`, hourly `generation` (MW) per `publishTime` run.
- Window: forecasts published 2025-12-23 → 2026-02-01 12:00 UTC, and actuals 2025-12-25 → 2026-02-02. This covers purchase decisions made during January 2026 (delivery 2026-01-02 → 2026-02-01), plus lead-in history for the error bands.
- January 2026 is history, so a snapshot is committed in `backend/data/`. To refresh it, run `python -m scripts.snapshot` from `backend/`. If the snapshot is missing, the app fetches live from Elexon.

## Method

- **Horizon h:** for each target hour, the latest forecast published at least h hours earlier.
- **Error:** `forecast − actual`. Positive means wind was over-forecast, so the buyer is short.
- **Decision band:** P10/P90 of signed errors over the previous 14 days at the gate-closure lead time. It uses only outturn published before gate closure, so there is no look-ahead. The band is hidden if there are fewer than 48 samples.
- WINDFOR is hourly, so all comparisons use hourly target times. Actuals are matched on the half-hour period that starts on the hour.

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
| `backend/tests/` | pytest suite using a synthetic dataset where error = 10 MW × horizon |
| `frontend/src/App.tsx` | App shell and tabs |
| `frontend/src/components/` | `DecisionView`, `AccuracyView`, `MetricCards` (+ tests) |
| `frontend/src/api.ts`, `types.ts` | Typed API client mirroring the backend schemas |
| `frontend/src/format.ts`, `useAsync.ts` | Formatting helpers and data-loading hook |
| `Dockerfile`, `docker-compose.yml` | Container build and local run (API + frontend in one image) |
| `api/index.py`, `vercel.json`, `requirements.txt` | Vercel deployment: serverless FastAPI function + static frontend |
| `docs/demo-script.md` | Outline for the demo video |
| `docs/superpowers/plans/` | The implementation plan this code was built from |

## API

| Endpoint | Description |
|---|---|
| `GET /api/meta` | Delivery window, default gate hour, data source |
| `GET /api/decision?delivery_date=2026-01-15&gate_hour=11` | Forecast at gate closure, P10–P90 band, outturn, metrics |
| `GET /api/accuracy?horizon=24&start=2026-01-02&end=2026-02-01` | Hourly forecast/actual pairs, metrics, error histogram |
| `GET /api/accuracy/by-horizon` | Metrics and P10/P90 error for horizons 0, 3, …, 48 h |

## Running

With Docker (recommended):

```bash
docker compose up --build
```

Then open http://localhost:8000.

Local development (Python 3.12+, Node 20+):

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

The app is deployed on Vercel (free tier). Vercel's CDN serves the built React app (`frontend/dist`), and `api/index.py` runs the same FastAPI app as a Python serverless function for `/api/*` (see `vercel.json`). The committed snapshot is bundled with the function, so there are no runtime calls to Elexon.

```bash
npx vercel login
npx vercel --prod
```

The Docker image in `Dockerfile` runs the identical app as a single container. It is used for local runs and can be deployed to any container host.

## AI tools

This project was built with the help of AI tools: Claude Code (Anthropic) assisted with planning, code generation and tests. All design decisions, the analysis method and the final code were reviewed by the author.
