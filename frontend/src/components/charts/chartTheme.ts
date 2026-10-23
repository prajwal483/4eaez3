// Mirrors styles/tokens.css: Recharts needs literal colour values, not CSS variables.
export const chartColors = {
  forecast: "#1f5fbf",
  forecastRange: "rgba(31, 95, 191, 0.12)",
  forecastRangeKey: "rgba(31, 95, 191, 0.28)",
  outturn: "#3d3d3a",
  risk: "#b45309",
  neutralBar: "#b4b2a9",
  grid: "#e6e5e1",
  axis: "#8a8984",
} as const;

export const gridProps = { stroke: chartColors.grid, vertical: false } as const;

export const axisProps = {
  axisLine: false,
  tickLine: false,
  tick: { fill: chartColors.axis, fontSize: 12 },
} as const;
