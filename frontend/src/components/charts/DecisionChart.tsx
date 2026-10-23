import { Area, CartesianGrid, ComposedChart, Line, ResponsiveContainer, Scatter, Tooltip, XAxis, YAxis } from "recharts";
import { formatDayHour, formatGw, formatGwRange, formatGwTick } from "../../format";
import type { DecisionPoint } from "../../types";
import type { LegendItem } from "./ChartLegend";
import { ChartTooltip, type TooltipLine } from "./ChartTooltip";
import { axisProps, chartColors, gridProps } from "./chartTheme";
import { type DecisionRow, toDecisionRows } from "./decisionSeries";
import { niceTicks } from "./ticks";

export const DECISION_LEGEND: LegendItem[] = [
  { label: "Forecast", color: chartColors.forecast, kind: "line" },
  { label: "Likely range (P10–P90)", color: chartColors.forecastRangeKey, kind: "area" },
  { label: "Outturn", color: chartColors.outturn, kind: "dashed" },
  { label: "Below range", color: chartColors.risk, kind: "dot" },
];

function tooltipLines(r: DecisionRow): TooltipLine[] {
  const lines: TooltipLine[] = [{ label: "Forecast", value: formatGw(r.forecast), color: chartColors.forecast }];
  if (r.range) {
    lines.push({ label: "Likely range", value: formatGwRange(r.range[0], r.range[1]), color: chartColors.forecast, kind: "area" });
  }
  lines.push({
    label: "Outturn",
    value: r.actual == null ? "Not yet available" : formatGw(r.actual),
    color: chartColors.outturn,
    kind: "dashed",
  });
  return lines;
}

export function DecisionChart({ points }: { points: DecisionPoint[] }) {
  const rows = toDecisionRows(points);
  const max = Math.max(0, ...points.flatMap((p) => [p.forecast_mw, p.actual_mw ?? 0, p.high_mw ?? 0]));
  const yTicks = niceTicks(0, max);
  const xTicks = rows.filter((_, i) => i % 3 === 0).map((r) => r.time);

  return (
    <ResponsiveContainer width="100%" height={340}>
      <ComposedChart data={rows} margin={{ top: 8, right: 8, bottom: 0, left: 0 }}>
        <CartesianGrid {...gridProps} />
        <XAxis dataKey="time" ticks={xTicks} interval={0} {...axisProps} />
        <YAxis ticks={yTicks} domain={[yTicks[0], yTicks[yTicks.length - 1]]} tickFormatter={formatGwTick} width={52} {...axisProps} />
        <Tooltip
          cursor={{ stroke: chartColors.grid }}
          content={<ChartTooltip<DecisionRow> title={(r) => formatDayHour(r.startTime)} lines={tooltipLines} />}
        />
        <Area dataKey="range" fill={chartColors.forecastRange} stroke="none" activeDot={false} isAnimationActive={false} />
        <Line dataKey="forecast" stroke={chartColors.forecast} strokeWidth={2} dot={false} isAnimationActive={false} />
        <Line
          dataKey="actual"
          stroke={chartColors.outturn}
          strokeWidth={1.5}
          strokeDasharray="5 4"
          dot={false}
          isAnimationActive={false}
        />
        <Scatter dataKey="below" fill={chartColors.risk} isAnimationActive={false} />
      </ComposedChart>
    </ResponsiveContainer>
  );
}
