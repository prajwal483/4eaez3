"""HTTP layer: validates inputs, delegates to analytics, serves the built frontend."""
from collections.abc import Callable
from datetime import date, time, timedelta
from pathlib import Path

import pandas as pd
from fastapi import FastAPI, HTTPException, Query
from fastapi.staticfiles import StaticFiles

from app import analytics
from app.config import (
    DEFAULT_GATE_CLOSURE_UTC,
    FIRST_DELIVERY_DATE,
    LAST_DELIVERY_DATE,
    MAX_HORIZON_HOURS,
    STATIC_DIR,
)
from app.schemas import AccuracyResponse, DecisionResponse, HorizonRow, Meta
from app.store import Dataset, get_dataset


def _window(start: date | None, end: date | None) -> tuple[pd.Timestamp, pd.Timestamp]:
    """Inclusive date range -> half-open UTC timestamp range."""
    start = start or FIRST_DELIVERY_DATE
    end = end or LAST_DELIVERY_DATE
    if start > end:
        raise HTTPException(status_code=400, detail="start must be on or before end")
    return (
        pd.Timestamp(start.isoformat(), tz="UTC"),
        pd.Timestamp((end + timedelta(days=1)).isoformat(), tz="UTC"),
    )


def create_app(
    dataset_provider: Callable[[], Dataset] = get_dataset,
    static_dir: Path | None = STATIC_DIR,
) -> FastAPI:
    app = FastAPI(title="GridBrick Wind Forecast Monitor")

    @app.get("/api/health")
    def health() -> dict:
        return {"status": "ok"}

    @app.get("/api/meta", response_model=Meta)
    def meta() -> Meta:
        ds = dataset_provider()
        return Meta(
            first_delivery_date=FIRST_DELIVERY_DATE,
            last_delivery_date=LAST_DELIVERY_DATE,
            default_gate_time_utc=DEFAULT_GATE_CLOSURE_UTC.strftime("%H:%M"),
            max_horizon_hours=MAX_HORIZON_HOURS,
            forecast_runs=int(ds.forecasts["publish_time"].nunique()),
            data_source=ds.source,
        )

    @app.get("/api/decision", response_model=DecisionResponse)
    def decision(
        delivery_date: date,
        gate_time: time = Query(DEFAULT_GATE_CLOSURE_UTC, description="Gate closure on D-1, HH:MM UTC"),
    ) -> dict:
        if not FIRST_DELIVERY_DATE <= delivery_date <= LAST_DELIVERY_DATE:
            raise HTTPException(
                status_code=400,
                detail=f"delivery_date must be between {FIRST_DELIVERY_DATE} and {LAST_DELIVERY_DATE}",
            )
        ds = dataset_provider()
        return analytics.decision_view(ds.forecasts, ds.actuals, delivery_date, gate_time)

    @app.get("/api/accuracy", response_model=AccuracyResponse)
    def accuracy(
        horizon: int = Query(24, ge=0, le=MAX_HORIZON_HOURS),
        start: date | None = None,
        end: date | None = None,
    ) -> dict:
        lo, hi = _window(start, end)
        ds = dataset_provider()
        return analytics.accuracy_view(ds.forecasts, ds.actuals, horizon, lo, hi)

    @app.get("/api/accuracy/by-horizon", response_model=list[HorizonRow])
    def by_horizon(start: date | None = None, end: date | None = None) -> list[dict]:
        lo, hi = _window(start, end)
        ds = dataset_provider()
        return analytics.horizon_profile(ds.forecasts, ds.actuals, lo, hi)

    if static_dir is not None and static_dir.is_dir():
        app.mount("/", StaticFiles(directory=static_dir, html=True), name="static")
    return app


app = create_app()
