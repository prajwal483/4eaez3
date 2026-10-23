"""API response contract. The frontend types are generated from this via OpenAPI."""

from datetime import date, datetime
from typing import Literal

from pydantic import BaseModel


class Metrics(BaseModel):
    n: int
    mae_mw: float | None
    rmse_mw: float | None
    bias_mw: float | None
    wape_pct: float | None
    p50_abs_mw: float | None
    p90_abs_mw: float | None


class DecisionPoint(BaseModel):
    start_time: datetime
    forecast_mw: float
    actual_mw: float | None
    low_mw: float | None
    high_mw: float | None


class DecisionResponse(BaseModel):
    delivery_date: date
    gate_closure: datetime
    forecast_published_at: datetime | None
    band_samples: int
    points: list[DecisionPoint]
    forecast_energy_mwh: float | None
    actual_energy_mwh: float | None
    metrics: Metrics


class AccuracyPoint(BaseModel):
    start_time: datetime
    publish_time: datetime
    forecast_mw: float
    actual_mw: float | None
    error_mw: float | None


class HistogramBin(BaseModel):
    bin_start_mw: float
    bin_end_mw: float
    count: int


class AccuracyResponse(BaseModel):
    horizon_hours: int
    points: list[AccuracyPoint]
    metrics: Metrics
    histogram: list[HistogramBin]


class HorizonRow(BaseModel):
    horizon_hours: int
    metrics: Metrics
    p10_error_mw: float | None
    p90_error_mw: float | None


class Meta(BaseModel):
    first_delivery_date: date
    last_delivery_date: date
    default_gate_time_utc: str
    max_horizon_hours: int
    forecast_runs: int
    data_source: Literal["snapshot", "live"]


class Health(BaseModel):
    status: Literal["ok"]
    data_source: Literal["snapshot", "live"]
    forecast_runs: int
    actual_periods: int


class ErrorDetail(BaseModel):
    field: str
    message: str


class ErrorBody(BaseModel):
    code: str
    message: str
    request_id: str | None = None
    details: list[ErrorDetail] | None = None


class ErrorResponse(BaseModel):
    error: ErrorBody
