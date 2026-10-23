import { niceTicks, weeklyTicks } from "./ticks";

describe("niceTicks", () => {
  it("rounds up to clean GW steps from zero", () => {
    expect(niceTicks(0, 21000)).toEqual([0, 5000, 10000, 15000, 20000, 25000]);
    expect(niceTicks(0, 18000)).toEqual([0, 5000, 10000, 15000, 20000]);
  });
  it("handles small ranges and a custom target count", () => {
    expect(niceTicks(0, 900)).toEqual([0, 200, 400, 600, 800, 1000]);
    expect(niceTicks(0, 1200, 4)).toEqual([0, 500, 1000, 1500]);
  });
  it("spans negative minimums", () => {
    expect(niceTicks(-850, 4500)).toEqual([-2000, 0, 2000, 4000, 6000]);
  });
  it("returns just zero for an empty range", () => {
    expect(niceTicks(0, 0)).toEqual([0]);
  });
});

describe("weeklyTicks", () => {
  it("keeps Monday midnights only", () => {
    expect(
      weeklyTicks(["2026-01-05T00:00:00Z", "2026-01-05T01:00:00Z", "2026-01-06T00:00:00Z", "2026-01-12T00:00:00Z"]),
    ).toEqual(["2026-01-05T00:00:00Z", "2026-01-12T00:00:00Z"]);
  });
});
