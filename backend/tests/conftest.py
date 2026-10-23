import pandas as pd
import pytest

from app.store import Dataset


def make_dataset() -> Dataset:
    """Synthetic data where forecast error is exactly 10 MW per hour of horizon."""
    actual_times = pd.date_range("2025-12-31", "2026-01-06", freq="30min", tz="UTC", inclusive="left")
    actuals = pd.DataFrame({"start_time": actual_times, "actual_mw": 1000.0})
    rows = []
    for publish in pd.date_range("2025-12-31", "2026-01-03 18:00", freq="6h", tz="UTC"):
        for k in range(49):
            rows.append({
                "publish_time": publish,
                "start_time": publish + pd.Timedelta(hours=k),
                "forecast_mw": 1000.0 + 10 * k,
            })
    forecasts = pd.DataFrame(rows).sort_values(["start_time", "publish_time"]).reset_index(drop=True)
    return Dataset(actuals=actuals, forecasts=forecasts, source="snapshot")


@pytest.fixture
def dataset() -> Dataset:
    return make_dataset()
