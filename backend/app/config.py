from datetime import UTC, date, datetime, time
from pathlib import Path

ELEXON_BASE = "https://data.elexon.co.uk/bmrs/api/v1/datasets"

# Purchase decisions are made on D-1 throughout January 2026, so delivery days run 2 Jan - 1 Feb.
FIRST_DELIVERY_DATE = date(2026, 1, 2)
LAST_DELIVERY_DATE = date(2026, 2, 1)

# Extra history before the window lets early-January decisions use prior forecast errors.
ACTUALS_FROM = date(2025, 12, 25)
ACTUALS_TO = date(2026, 2, 2)
FORECASTS_PUBLISHED_FROM = datetime(2025, 12, 23, tzinfo=UTC)
FORECASTS_PUBLISHED_TO = datetime(2026, 2, 1, 12, tzinfo=UTC)

# Since Brexit (Jan 2021) the first GB day-ahead auction (EPEX 60-min) closes at 09:20 UK time on D-1;
# N2EX follows at 09:50. UK time equals UTC in January.
DEFAULT_GATE_CLOSURE_UTC = time(9, 20)
MAX_HORIZON_HOURS = 48

BACKEND_DIR = Path(__file__).resolve().parent.parent
SNAPSHOT_DIR = BACKEND_DIR / "data"
STATIC_DIR = BACKEND_DIR / "static"

API_VERSION = "1.0.0"
