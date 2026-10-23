import pandas as pd

from app.store import load_snapshot, save_snapshot


def test_snapshot_round_trip(tmp_path, dataset):
    save_snapshot(dataset, tmp_path)
    loaded = load_snapshot(tmp_path)
    assert loaded.source == "snapshot"
    pd.testing.assert_frame_equal(loaded.actuals, dataset.actuals)
    pd.testing.assert_frame_equal(loaded.forecasts, dataset.forecasts)
