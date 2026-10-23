import type { DecisionResponse } from "../../types";

// Points are hourly, so summed MW are MWh.
export function shortfallAtRiskMwh(d: DecisionResponse): number | null {
  if (d.points.length === 0 || d.points.some((p) => p.low_mw == null)) return null;
  return d.points.reduce((sum, p) => sum + (p.forecast_mw - (p.low_mw as number)), 0);
}
