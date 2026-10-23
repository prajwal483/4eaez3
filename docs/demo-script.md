# Demo video script (≤ 10 min)

## Part 1 — Client pitch (≤ 5 min)
1. (0:30) Problem: day-ahead bids are locked in at 09:20 on D-1 (EPEX GB auction; N2EX at 09:50), and wind is the biggest swing factor in what still needs buying.
2. (1:30) Day-ahead decision tab:
   - Pick a January day and show the forecast that was actually available at gate closure, the likely range, and "shortfall at risk" in GWh.
   - On 2 Jan the outturn fell below the whole range, which shows why a single forecast number is risky.
   - Switch to a windy day and then a calm day to contrast them.
3. (1:30) Forecast accuracy tab:
   - Headline numbers at 24 h: MAE about 1.9 GW, WAPE about 17%.
   - Key insight: WINDFOR runs a consistent 1.5–1.8 GW above outturn, even at 0 h. Present it as "forecast vs metered outturn gap" and note that it likely includes curtailment and coverage differences, not just forecast skill.
   - Drag the horizon slider to show error growing from 1.7 GW (0 h) to 2.3 GW (48 h).
4. (1:00) Value and next steps:
   - Size hedges from the P10 shortfall, treating it as a lower bound (the range covers 78% of hours vs 80% nominal). Investigate the outturn gap before applying any bias correction.
   - Next: more fuel types, a live data feed, alerts.

## Part 2 — Tech lead review (≤ 5 min)
1. (1:00) Architecture: Elexon → snapshot/live store → pure pandas analytics → FastAPI → React. Docker image for local runs; deployed on Vercel (CDN frontend + serverless FastAPI).
2. (1:30) Analysis design:
   - Horizon definition ("latest forecast published ≥ h before").
   - Sign convention.
   - The no-look-ahead error band: only outturn published before gate closure, at each hour's own lead time. Show the calibration result (78% inside, 15% below P10) and why it skews to the downside.
   - Why the comparison is hourly.
3. (1:30) Code walkthrough:
   - `analytics.py`: pure, and unit-tested on a synthetic dataset where error = 10 MW × horizon, so every expected value can be checked by hand.
   - `main.py`: a thin HTTP layer with a dependency-injected dataset.
   - The frontend's typed client and the tests per view.
4. (1:00) Practices and trade-offs:
   - TDD, pinned dependencies, a committed reproducible snapshot, and disclosed AI-assisted development.
   - Trade-offs and what to do next: response caching, CI, a longer or bias-adjusted error window to fix band calibration, and validating the outturn gap against curtailment data.
