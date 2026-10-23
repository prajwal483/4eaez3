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
