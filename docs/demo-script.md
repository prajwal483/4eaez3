# Demo video script (≤ 10 min)

## Part 1 — Client pitch (≤ 5 min)
1. (0:30) Problem: day-ahead bids are locked in at 11:00 on D-1, and wind is the biggest swing factor in what still needs buying.
2. (1:30) Day-ahead decision tab:
   - Pick a January day and show the forecast that was actually available at gate closure, the likely range, and "shortfall at risk" in GWh.
   - On 2 Jan the outturn fell below the whole range, which shows why a single forecast number is risky.
   - Switch to a windy day and then a calm day to contrast them.
3. (1:30) Forecast accuracy tab:
   - Headline numbers at 24 h: MAE about 1.9 GW, WAPE about 17%.
   - Key insight: a consistent +1.5–1.8 GW over-forecast bias.
   - Drag the horizon slider to show error growing from 1.7 GW (0 h) to 2.3 GW (48 h).
4. (1:00) Value and next steps:
   - Correct for the known bias and size hedges from the P10 shortfall.
   - Next: more fuel types, a live data feed, alerts.

## Part 2 — Tech lead review (≤ 5 min)
1. (1:00) Architecture: Elexon → snapshot/live store → pure pandas analytics → FastAPI → React. One Docker image, deployed on Heroku.
2. (1:30) Analysis design:
   - Horizon definition ("latest forecast published ≥ h before").
   - Sign convention.
   - The no-look-ahead error band (only outturn published before gate closure).
   - Why the comparison is hourly.
3. (1:30) Code walkthrough:
   - `analytics.py`: pure, and unit-tested on a synthetic dataset where error = 10 MW × horizon, so every expected value can be checked by hand.
   - `main.py`: a thin HTTP layer with a dependency-injected dataset.
   - The frontend's typed client and the tests per view.
4. (1:00) Practices and trade-offs:
   - TDD, pinned dependencies, a committed reproducible snapshot, and disclosed AI-assisted development.
   - Trade-offs and what to do next: response caching, CI, a quantile-calibration check of the P10–P90 band, and a bias-corrected forecast.
