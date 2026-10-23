import { CartesianGrid, Line, LineChart, ResponsiveContainer, Tooltip, XAxis, YAxis } from "recharts";
import { formatDayHour, formatDayShort, formatGw, formatGwDelta, formatGwTick } from "../../format";
import type { AccuracyPoint } from "../../types";
import { ChartTooltip, type TooltipLine } from "./ChartTooltip";
import { axisProps, chartColors, gridProps } from "./chartTheme";
import { niceTicks, weeklyTicks } from "./ticks";

interface SeriesRow {
  startTime: string;
  forecast: number;
  actual: number | null;
  error: number | null;
}

const lines = (r: SeriesRow): TooltipLine[] => [
  { label: "Forecast", value: formatGw(r.forecast), color: chartColors.forecast },
  { label: "Outturn", value: formatGw(r.actual), color: chartColors.outturn, kind: "dashed" },
  { label: "Error", value: formatGwDelta(r.error), color: chartColors.risk },
];

export function AccuracySeriesChart({ points }: { points: AccuracyPoint[] }) {
  const rows: SeriesRow[] = points.map((p) => ({
    startTime: p.start_time,
    forecast: p.forecast_mw,
    actual: p.actual_mw,
    error: p.error_mw,
  }));
  const max = Math.max(0, ...points.flatMap((p) => [p.forecast_mw, p.actual_mw ?? 0]));
  const yTicks = niceTicks(0, max);

  return (
    <ResponsiveContainer width="100%" height={300}>
      <LineChart data={rows} margin={{ top: 8, right: 8, bottom: 0, left: 0 }}>
        <CartesianGrid {...gridProps} />
        <XAxis
          dataKey="startTime"
          ticks={weeklyTicks(rows.map((r) => r.startTime))}
          interval={0}
          tickFormatter={formatDayShort}
          {...axisProps}
        />
        <YAxis ticks={yTicks} domain={[yTicks[0], yTicks[yTicks.length - 1]]} tickFormatter={formatGwTick} width={52} {...axisProps} />
        <Tooltip
          cursor={{ stroke: chartColors.grid }}
          content={<ChartTooltip<SeriesRow> title={(r) => formatDayHour(r.startTime)} lines={lines} />}
        />
        <Line dataKey="forecast" stroke={chartColors.forecast} strokeWidth={1.5} dot={false} isAnimationActive={false} />
        <Line
          dataKey="actual"
          stroke={chartColors.outturn}
          strokeWidth={1.25}
          strokeDasharray="4 3"
          dot={false}
          isAnimationActive={false}
        />
      </LineChart>
    </ResponsiveContainer>
  );
}
