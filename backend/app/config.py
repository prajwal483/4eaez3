from datetime import date, datetime, timezone
from pathlib import Path

ELEXON_BASE = "https://data.elexon.co.uk/bmrs/api/v1/datasets"

# Purchase decisions are made on D-1 throughout January 2026, so delivery days run 2 Jan - 1 Feb.
FIRST_DELIVERY_DATE = date(2026, 1, 2)
LAST_DELIVERY_DATE = date(2026, 2, 1)

# Extra history before the window lets early-January decisions use prior forecast errors.
ACTUALS_FROM = date(2025, 12, 25)
ACTUALS_TO = date(2026, 2, 2)
FORECASTS_PUBLISHED_FROM = datetime(2025, 12, 23, tzinfo=timezone.utc)
FORECASTS_PUBLISHED_TO = datetime(2026, 2, 1, 12, tzinfo=timezone.utc)

# GB day-ahead auction gate closure is 11:00 UK time on D-1; UK time equals UTC in January.
DEFAULT_GATE_CLOSURE_HOUR_UTC = 11
MAX_HORIZON_HOURS = 48

BACKEND_DIR = Path(__file__).resolve().parent.parent
SNAPSHOT_DIR = BACKEND_DIR / "data"
STATIC_DIR = BACKEND_DIR / "static"
