import type { AccuracyResponse, DecisionResponse, HorizonRow, Meta, Metrics } from "../types";

export const metricsFixture: Metrics = {
  n: 744, mae_mw: 512.3, rmse_mw: 690.1, bias_mw: 120.4, wape_pct: 6.2, p50_abs_mw: 400, p90_abs_mw: 1100,
};

export const metaFixture: Meta = {
  first_delivery_date: "2026-01-02",
  last_delivery_date: "2026-02-01",
  default_gate_hour_utc: 11,
  max_horizon_hours: 48,
  forecast_runs: 325,
  data_source: "snapshot",
};

export const decisionFixture: DecisionResponse = {
  delivery_date: "2026-01-02",
  gate_closure: "2026-01-01T11:00:00Z",
  forecast_published_at: "2026-01-01T09:30:00Z",
  band_samples: 312,
  points: [
    { start_time: "2026-01-02T00:00:00Z", forecast_mw: 1000, actual_mw: 950, low_mw: 800, high_mw: 1100 },
    { start_time: "2026-01-02T01:00:00Z", forecast_mw: 1200, actual_mw: 1250, low_mw: 900, high_mw: 1300 },
  ],
  forecast_energy_mwh: 2200,
  actual_energy_mwh: 2200,
  metrics: { ...metricsFixture, n: 2, mae_mw: 50 },
};

export const accuracyFixture: AccuracyResponse = {
  horizon_hours: 24,
  points: [
    { start_time: "2026-01-02T00:00:00Z", publish_time: "2026-01-01T00:00:00Z", forecast_mw: 1000, actual_mw: 900, error_mw: 100 },
  ],
  metrics: metricsFixture,
  histogram: [{ bin_start_mw: 0, bin_end_mw: 250, count: 1 }],
};

export const horizonFixture: HorizonRow[] = [
  { horizon_hours: 0, metrics: { ...metricsFixture, mae_mw: 200 }, p10_error_mw: -300, p90_error_mw: 250 },
  { horizon_hours: 24, metrics: metricsFixture, p10_error_mw: -900, p90_error_mw: 1000 },
];
