# 3. Serve a committed snapshot instead of calling Elexon at runtime

## Context
January 2026 is history, so the data won't change. The whole window is small: about 1.9k half-hourly actuals and 24k forecast rows.

## Decision
`backend/scripts/snapshot.py` downloads the window once into `backend/data/*.csv.gz`, which is committed. The app reads the snapshot and only fetches live from Elexon if the files are missing.

## Consequences
Results are reproducible, the demo works when Elexon is down, and responses can be cached aggressively (see decision 7). Refreshing data is a deliberate step, not a side effect of traffic.
