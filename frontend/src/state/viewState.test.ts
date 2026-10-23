import { readViewState, toSearch, type ViewLimits } from "./viewState";

const limits: ViewLimits = {
  days: ["2026-01-02", "2026-01-03"],
  gates: ["09:20", "09:50"],
  maxHorizon: 48,
  defaultGate: "09:20",
  defaultHorizon: 24,
};

describe("viewState", () => {
  it("reads a full, valid query string", () => {
    expect(readViewState("?tab=accuracy&day=2026-01-03&gate=09%3A50&h=6", limits)).toEqual({
      tab: "accuracy",
      day: "2026-01-03",
      gate: "09:50",
      horizon: 6,
    });
  });
  it("falls back to defaults for missing or invalid values", () => {
    expect(readViewState("?tab=nope&day=2025-12-01&gate=11:00&h=99", limits)).toEqual({
      tab: "decision",
      day: "2026-01-02",
      gate: "09:20",
      horizon: 24,
    });
    expect(readViewState("", limits).tab).toBe("decision");
  });
  it("rejects non-integer and empty horizons", () => {
    expect(readViewState("?h=6.5", limits).horizon).toBe(24);
    expect(readViewState("?h=", limits).horizon).toBe(24);
    expect(readViewState("?h=0", limits).horizon).toBe(0);
  });
  it("round-trips through the query string", () => {
    const state = { tab: "accuracy", day: "2026-01-03", gate: "09:50", horizon: 12 } as const;
    expect(readViewState(toSearch(state), limits)).toEqual(state);
  });
});
