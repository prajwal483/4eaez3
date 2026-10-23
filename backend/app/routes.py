"""Version 1 of the HTTP API. Handlers stay thin: validate input, call analytics, return a schema.

Handlers are plain `def`: the work is CPU-bound pandas, which FastAPI runs in its threadpool.
"""

from datetime import date, time, timedelta
from typing import Annotated

import pandas as pd
from fastapi import APIRouter, Query

from app import analytics
from app.config import DEFAULT_GATE_CLOSURE_UTC, FIRST_DELIVERY_DATE, LAST_DELIVERY_DATE, MAX_HORIZON_HOURS
from app.deps import DatasetDep
from app.errors import ApiError
from app.schemas import AccuracyResponse, DecisionResponse, ErrorResponse, Health, HorizonRow, Meta

router = APIRouter(
    responses={
        400: {"model": ErrorResponse, "description": "Request outside the supported range"},
        422: {"model": ErrorResponse, "description": "Invalid parameters"},
    }
)

DeliveryDate = Annotated[
    date,
    Query(description=f"Delivery day (UTC), {FIRST_DELIVERY_DATE} to {LAST_DELIVERY_DATE}", examples=["2026-01-15"]),
]
GateTime = Annotated[time, Query(description="Gate closure on D-1, HH:MM UTC", examples=["09:20"])]
Horizon = Annotated[
    int, Query(ge=0, le=MAX_HORIZON_HOURS, description="Minimum hours between forecast publication and delivery")
]
StartDate = Annotated[date | None, Query(description="First delivery day to include (default: start of window)")]
EndDate = Annotated[date | None, Query(description="Last delivery day to include, inclusive (default: end of window)")]


def _window(start: date | None, end: date | None) -> tuple[pd.Timestamp, pd.Timestamp]:
    """Inclusive date range -> half-open UTC timestamp range."""
    start = start or FIRST_DELIVERY_DATE
    end = end or LAST_DELIVERY_DATE
    if start > end:
        raise ApiError(400, "invalid_range", "start must be on or before end")
    return (
        pd.Timestamp(start.isoformat(), tz="UTC"),
        pd.Timestamp((end + timedelta(days=1)).isoformat(), tz="UTC"),
    )


@router.get("/health", response_model=Health, tags=["system"], summary="Liveness and loaded dataset")
def health(ds: DatasetDep) -> Health:
    return Health(
        status="ok",
        data_source=ds.source,
        forecast_runs=int(ds.forecasts["publish_time"].nunique()),
        actual_periods=len(ds.actuals),
    )


@router.get("/meta", response_model=Meta, tags=["reference"], summary="Delivery window and defaults")
def meta(ds: DatasetDep) -> Meta:
    return Meta(
        first_delivery_date=FIRST_DELIVERY_DATE,
        last_delivery_date=LAST_DELIVERY_DATE,
        default_gate_time_utc=DEFAULT_GATE_CLOSURE_UTC.strftime("%H:%M"),
        max_horizon_hours=MAX_HORIZON_HOURS,
        forecast_runs=int(ds.forecasts["publish_time"].nunique()),
        data_source=ds.source,
    )


@router.get(
    "/decision",
    response_model=DecisionResponse,
    tags=["decision"],
    summary="Forecast available at gate closure for one delivery day",
)
def decision(ds: DatasetDep, delivery_date: DeliveryDate, gate_time: GateTime = DEFAULT_GATE_CLOSURE_UTC) -> dict:
    if not FIRST_DELIVERY_DATE <= delivery_date <= LAST_DELIVERY_DATE:
        raise ApiError(
            400, "out_of_window", f"delivery_date must be between {FIRST_DELIVERY_DATE} and {LAST_DELIVERY_DATE}"
        )
    return analytics.decision_view(ds.forecasts, ds.actuals, delivery_date, gate_time)


@router.get("/accuracy", response_model=AccuracyResponse, tags=["accuracy"], summary="Forecast accuracy at one horizon")
def accuracy(ds: DatasetDep, horizon: Horizon = 24, start: StartDate = None, end: EndDate = None) -> dict:
    lo, hi = _window(start, end)
    return analytics.accuracy_view(ds.forecasts, ds.actuals, horizon, lo, hi)


@router.get(
    "/accuracy/by-horizon",
    response_model=list[HorizonRow],
    tags=["accuracy"],
    summary="Error metrics for every 3 h horizon from 0 to 48 h",
)
def by_horizon(ds: DatasetDep, start: StartDate = None, end: EndDate = None) -> list[dict]:
    lo, hi = _window(start, end)
    return analytics.horizon_profile(ds.forecasts, ds.actuals, lo, hi)
