# 4. Compare forecasts and actuals hourly

## Context
WINDFOR forecasts are hourly; FUELHH actuals are half-hourly.

## Decision
Compare on WINDFOR's hourly target times, matching each forecast to the half-hour period that starts on the hour.

## Consequences
Simple and transparent. Averaging both half-hours instead would change the 24 h MAE by about 16 MW (1932 vs 1948 MW), which doesn't change any conclusion.
