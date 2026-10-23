import { decisionFixture } from "../../test/fixtures";
import { shortfallAtRiskMwh } from "./shortfall";

describe("shortfallAtRiskMwh", () => {
  it("sums forecast minus P10 over hourly points", () => {
    expect(shortfallAtRiskMwh(decisionFixture)).toBe(500);
  });
  it("is null when any hour has no range", () => {
    const points = [{ ...decisionFixture.points[0], low_mw: null, high_mw: null }, decisionFixture.points[1]];
    expect(shortfallAtRiskMwh({ ...decisionFixture, points })).toBeNull();
  });
  it("is null with no points", () => {
    expect(shortfallAtRiskMwh({ ...decisionFixture, points: [] })).toBeNull();
  });
});
