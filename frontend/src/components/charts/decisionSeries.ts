import { formatHourUtc } from "../../format";
import type { DecisionPoint } from "../../types";

export interface DecisionRow {
  time: string;
  startTime: string;
  forecast: number;
  actual: number | null;
  range: [number, number] | null;
  below: number | null;
}

const isBelowRange = (p: DecisionPoint): boolean => p.actual_mw != null && p.low_mw != null && p.actual_mw < p.low_mw;

export const belowRangeHours = (points: DecisionPoint[]): string[] =>
  points.filter(isBelowRange).map((p) => p.start_time);

export const toDecisionRows = (points: DecisionPoint[]): DecisionRow[] =>
  points.map((p) => ({
    time: formatHourUtc(p.start_time),
    startTime: p.start_time,
    forecast: p.forecast_mw,
    actual: p.actual_mw,
    range: p.low_mw != null && p.high_mw != null ? [p.low_mw, p.high_mw] : null,
    below: isBelowRange(p) ? p.actual_mw : null,
  }));
