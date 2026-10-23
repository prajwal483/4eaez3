# 5. Likely range from recent errors at each hour's own lead time

## Context
A buyer needs a range, not just a number. The range must only use information available at gate closure, or it will look better than it really is.

## Decision
For each delivery hour, take signed errors from the previous 14 days at that hour's lead time from gate closure, using only actuals published before the gate. Report P10–P90. Hide the range when fewer than 48 samples exist.

My first version used one lead time (13 h) for the whole day. A calibration check showed outturn fell inside the range 77% of the time against 80% nominal, so I switched to per-hour lead times.

## Consequences
Coverage over January is 78.0% inside, 15.3% below P10 and 6.7% above P90 (`python -m scripts.calibration`). The range is still too narrow on the downside, so "shortfall at risk" should be read as a lower bound. The obvious next step is a longer or bias-adjusted window.
