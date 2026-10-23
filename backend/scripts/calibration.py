"""Check the decision-view P10-P90 range against January 2026 outturn (nominal: 80% inside, 10% below, 10% above)."""
from datetime import time

from app.analytics import band_calibration
from app.config import DEFAULT_GATE_CLOSURE_UTC, FIRST_DELIVERY_DATE, LAST_DELIVERY_DATE
from app.store import get_dataset


def main() -> None:
    ds = get_dataset()
    for gate in (DEFAULT_GATE_CLOSURE_UTC, time(9, 50)):
        cal = band_calibration(ds.forecasts, ds.actuals, FIRST_DELIVERY_DATE, LAST_DELIVERY_DATE, gate)
        print(f"gate {gate:%H:%M}: n={cal['n']} inside={cal['inside_pct']}% "
              f"below P10={cal['below_p10_pct']}% above P90={cal['above_p90_pct']}%")


if __name__ == "__main__":
    main()
