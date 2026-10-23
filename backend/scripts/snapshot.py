"""Download the January 2026 decision window from Elexon into backend/data."""
import httpx

from app.config import SNAPSHOT_DIR
from app.store import fetch_live, save_snapshot


def main() -> None:
    with httpx.Client() as client:
        ds = fetch_live(client)
    save_snapshot(ds, SNAPSHOT_DIR)
    print(f"actuals: {len(ds.actuals)} rows, forecasts: {len(ds.forecasts)} rows -> {SNAPSHOT_DIR}")


if __name__ == "__main__":
    main()
