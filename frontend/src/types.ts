// Mirrors backend/app/schemas.py. Datetimes are ISO-8601 UTC strings; dates are YYYY-MM-DD.
export interface Metrics {
  n: number;
  mae_mw: number | null;
  rmse_mw: number | null;
  bias_mw: number | null;
  wape_pct: number | null;
  p50_abs_mw: number | null;
  p90_abs_mw: number | null;
}

export interface DecisionPoint {
  start_time: string;
  forecast_mw: number;
  actual_mw: number | null;
  low_mw: number | null;
  high_mw: number | null;
}

export interface DecisionResponse {
  delivery_date: string;
  gate_closure: string;
  forecast_published_at: string | null;
  band_samples: number;
  points: DecisionPoint[];
  forecast_energy_mwh: number | null;
  actual_energy_mwh: number | null;
  metrics: Metrics;
}

export interface AccuracyPoint {
  start_time: string;
  publish_time: string;
  forecast_mw: number;
  actual_mw: number | null;
  error_mw: number | null;
}

export interface HistogramBin {
  bin_start_mw: number;
  bin_end_mw: number;
  count: number;
}

export interface AccuracyResponse {
  horizon_hours: number;
  points: AccuracyPoint[];
  metrics: Metrics;
  histogram: HistogramBin[];
}

export interface HorizonRow {
  horizon_hours: number;
  metrics: Metrics;
  p10_error_mw: number | null;
  p90_error_mw: number | null;
}

export interface Meta {
  first_delivery_date: string;
  last_delivery_date: string;
  default_gate_time_utc: string; // HH:MM
  max_horizon_hours: number;
  forecast_runs: number;
  data_source: "snapshot" | "live";
}
