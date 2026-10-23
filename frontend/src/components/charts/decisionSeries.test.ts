import type { DecisionPoint } from "../../types";
import { belowRangeHours, toDecisionRows } from "./decisionSeries";

const points: DecisionPoint[] = [
  { start_time: "2026-01-15T00:00:00Z", forecast_mw: 1000, actual_mw: 700, low_mw: 800, high_mw: 1100 },
  { start_time: "2026-01-15T01:00:00Z", forecast_mw: 1000, actual_mw: 900, low_mw: 800, high_mw: 1100 },
  { start_time: "2026-01-15T02:00:00Z", forecast_mw: 1000, actual_mw: null, low_mw: 800, high_mw: 1100 },
  { start_time: "2026-01-15T03:00:00Z", forecast_mw: 1000, actual_mw: 500, low_mw: null, high_mw: null },
];

describe("decisionSeries", () => {
  it("finds hours where outturn fell below the likely range", () => {
    expect(belowRangeHours(points)).toEqual(["2026-01-15T00:00:00Z"]);
  });

  it("builds chart rows with range and below-range markers", () => {
    const rows = toDecisionRows(points);
    expect(rows[0]).toEqual({
      time: "00:00",
      startTime: "2026-01-15T00:00:00Z",
      forecast: 1000,
      actual: 700,
      range: [800, 1100],
      below: 700,
    });
    expect(rows[1].below).toBeNull();
    expect(rows[3].range).toBeNull();
  });
});
