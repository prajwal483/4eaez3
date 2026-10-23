import { deliveryDates, formatDayHourUtc, formatGwh, formatHourUtc, formatMw, formatPct, formatUtc } from "./format";

describe("format", () => {
  it("formats MW with thousands separators", () => {
    expect(formatMw(12345.6)).toBe("12,346 MW");
    expect(formatMw(null)).toBe("—");
  });
  it("formats MWh as GWh", () => {
    expect(formatGwh(31080)).toBe("31.1 GWh");
    expect(formatGwh(null)).toBe("—");
  });
  it("formats percentages", () => {
    expect(formatPct(6.25)).toBe("6.3%");
  });
  it("formats UTC timestamps", () => {
    expect(formatUtc("2026-01-02T06:00:00Z")).toBe("2026-01-02 06:00 UTC");
    expect(formatUtc(null)).toBe("—");
    expect(formatHourUtc("2026-01-02T06:00:00Z")).toBe("06:00");
    expect(formatDayHourUtc("2026-01-02T06:00:00Z")).toBe("02 Jan 06:00");
  });
  it("lists delivery dates inclusively", () => {
    const dates = deliveryDates("2026-01-30", "2026-02-01");
    expect(dates).toEqual(["2026-01-30", "2026-01-31", "2026-02-01"]);
  });
});
