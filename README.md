# GridBrick · Wind Forecast Monitor

A pilot web app for a UK utility's day-ahead power buying team. It answers two questions for January 2026 delivery:

1. **What wind forecast was available when we had to buy?** For each delivery day the app shows the latest GB national wind forecast published before day-ahead gate closure on D-1. The default is 09:20 UTC, the EPEX GB 60-minute auction; the N2EX (09:50) and EPEX 30-minute (15:30) auctions can also be selected. Around that forecast it shows an empirical P10–P90 range and the "shortfall at risk": the energy to cover if wind lands at its P10.
2. **How much can we trust it?** It reports MAE, RMSE, bias, WAPE and P90 absolute error for any forecast lead time from 0 to 48 h, plus the error distribution and how error grows with lead time.

**Live app:** https://4eaez3.vercel.app

## Key findings (January 2026 delivery, 744 hours)

| Lead time | MAE | Bias (forecast − actual) | WAPE |
|---|---|---|---|
| 0 h | 1.68 GW | +1.48 GW | 14.9% |
| 24 h | 1.93 GW | +1.74 GW | 17.1% |
| 48 h | 2.30 GW | +1.80 GW | 20.5% |

- Forecasts get less accurate the further ahead they look: MAE rises from 1.7 GW to 2.3 GW between 0 and 48 h.
- WINDFOR sits **about 1.5–1.8 GW above FUELHH outturn** at every lead time, even at 0 h, where it is above outturn in about 90% of hours. That pattern points to a structural gap between the two datasets rather than forecasting skill alone. Likely causes are transmission-constraint curtailment (FUELHH is metered output after balancing actions) and differences in which wind farms each dataset covers. See Caveats before using the bias for decisions.
- At the day-ahead gate, delivery hours are about 15–39 h ahead. The app turns the error spread at each hour's lead time into a per-day "shortfall at risk" figure.

## Data

- Actuals: Elexon BMRS `FUELHH`, `fuelType = WIND`, half-hourly `generation` (MW).
- Forecasts: Elexon BMRS `WINDFOR`, hourly `generation` (MW) per `publishTime` run.
- Window: forecasts published 2025-12-23 → 2026-02-01 12:00 UTC, and actuals 2025-12-25 → 2026-02-02. This covers purchase decisions made during January 2026 (delivery 2026-01-02 → 2026-02-01), plus lead-in history for the error bands.
- January 2026 is history, so a snapshot is committed in `backend/data/`. To refresh it, run `python -m scripts.snapshot` from `backend/`. If the snapshot is missing, the app fetches live from Elexon.

## Method

- **Horizon h:** for each target hour, the latest forecast published at least h hours earlier.
- **Error:** `forecast − actual`. Positive means wind was over-forecast, so the buyer is short.
- **Decision band:** for each delivery hour, P10/P90 of signed errors over the previous 14 days at that hour's own lead time from gate closure. It uses only outturn published before gate closure, so there is no look-ahead. The band is hidden if there are fewer than 48 samples.
- **Band calibration** (`python -m scripts.calibration`, all 744 January hours, 09:20 gate): outturn fell inside the P10–P90 range in **78.0%** of hours (nominal 80%), below P10 in **15.3%** (nominal 10%) and above P90 in **6.7%** (nominal 10%). So the range is somewhat too optimistic on the downside, and the "shortfall at risk" figure should be read as a lower bound.
- WINDFOR is hourly, so all comparisons use hourly target times. Actuals are matched on the half-hour period that starts on the hour.

## Caveats

- **Bias interpretation:** the consistent forecast-above-outturn gap is measured correctly, but it probably mixes forecast error with curtailment and dataset-coverage effects. Any bias correction should be validated (for example against curtailment volumes) before it drives purchasing.
- **Gate closure:** times are UK local time, which equals UTC in January. The app uses the published auction times and does not model bid-preparation lead time.
- **Range calibration:** the P10–P90 range under-covers the downside (see Method). A longer or bias-adjusted error window is the obvious next step.

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
| `backend/scripts/calibration.py` | Measures how often outturn lands inside the decision-view P10–P90 range |
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
| `GET /api/meta` | Delivery window, default gate closure time, data source |
| `GET /api/decision?delivery_date=2026-01-15&gate_time=09:20` | Forecast at gate closure, P10–P90 band, outturn, metrics |
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
