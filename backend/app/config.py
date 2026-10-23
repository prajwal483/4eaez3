from datetime import UTC, date, datetime, time
from pathlib import Path

ELEXON_BASE = "https://data.elexon.co.uk/bmrs/api/v1/datasets"

# Decisions on D-1 during January 2026 cover delivery from 2 Jan to 1 Feb.
FIRST_DELIVERY_DATE = date(2026, 1, 2)
LAST_DELIVERY_DATE = date(2026, 2, 1)

# Lead-in history so early-January decisions have past errors to build a range from.
ACTUALS_FROM = date(2025, 12, 25)
ACTUALS_TO = date(2026, 2, 2)
FORECASTS_PUBLISHED_FROM = datetime(2025, 12, 23, tzinfo=UTC)
FORECASTS_PUBLISHED_TO = datetime(2026, 2, 1, 12, tzinfo=UTC)

# EPEX GB 60-min auction, post-Brexit. UK time equals UTC in January.
DEFAULT_GATE_CLOSURE_UTC = time(9, 20)
MAX_HORIZON_HOURS = 48

BACKEND_DIR = Path(__file__).resolve().parent.parent
SNAPSHOT_DIR = BACKEND_DIR / "data"
STATIC_DIR = BACKEND_DIR / "static"

API_VERSION = "1.0.0"
