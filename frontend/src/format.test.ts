import {
  deliveryDates,
  formatDayHour,
  formatDayHourUtc,
  formatDayLong,
  formatDayShort,
  formatGw,
  formatGwDelta,
  formatGwh,
  formatGwRange,
  formatGwSigned,
  formatGwTick,
  formatHourUtc,
  formatMw,
  formatPct,
  formatUtc,
  formatWeekdayDay,
} from "./format";

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
    expect(deliveryDates("2026-01-30", "2026-02-01")).toEqual(["2026-01-30", "2026-01-31", "2026-02-01"]);
  });
  it("formats days in words", () => {
    expect(formatWeekdayDay("2026-01-15")).toBe("Thu 15 Jan");
    expect(formatDayLong("2026-01-15")).toBe("Thu 15 Jan 2026");
    expect(formatDayLong("2026-01-02")).toBe("Fri 2 Jan 2026");
    expect(formatDayHour("2026-01-15T14:00:00Z")).toBe("Thu 15 Jan, 14:00");
    expect(formatDayShort("2026-01-05T00:00:00Z")).toBe("5 Jan");
  });
  it("formats GW values with a true minus sign", () => {
    expect(formatGw(15834)).toBe("15.8 GW");
    expect(formatGw(-500)).toBe("−0.5 GW");
    expect(formatGw(null)).toBe("—");
    expect(formatGwRange(11002, 16562)).toBe("11.0–16.6 GW");
    expect(formatGwRange(-900, 4500)).toBe("−0.9–4.5 GW");
    expect(formatGwDelta(1200)).toBe("+1.2 GW");
    expect(formatGwDelta(-1200)).toBe("−1.2 GW");
    expect(formatGwDelta(null)).toBe("—");
  });
  it("formats axis ticks and bin labels", () => {
    expect(formatGwTick(0)).toBe("0 GW");
    expect(formatGwTick(5000)).toBe("5 GW");
    expect(formatGwTick(2500)).toBe("2.5 GW");
    expect(formatGwTick(-2000)).toBe("−2 GW");
    expect(formatGwSigned(-1000)).toBe("−1");
    expect(formatGwSigned(0)).toBe("0");
    expect(formatGwSigned(1000)).toBe("+1");
    expect(formatGwSigned(250)).toBe("+0.25");
  });
});
