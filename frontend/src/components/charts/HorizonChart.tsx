import { memo, useMemo } from "react";
import { Area, CartesianGrid, ComposedChart, Line, ReferenceLine, ResponsiveContainer, Tooltip, XAxis, YAxis } from "recharts";
import { formatGw, formatGwRange, formatGwTick } from "../../format";
import type { HorizonRow } from "../../types";
import { ChartTooltip, type TooltipLine } from "./ChartTooltip";
import { axisProps, chartColors, gridProps } from "./chartTheme";
import { niceTicks } from "./ticks";

interface Row {
  horizon: number;
  mae: number | null;
  band: [number, number] | null;
}

const lines = (r: Row): TooltipLine[] => {
  const out: TooltipLine[] = [{ label: "MAE", value: formatGw(r.mae), color: chartColors.forecast }];
  if (r.band) out.push({ label: "P10–P90 error", value: formatGwRange(r.band[0], r.band[1]), color: chartColors.forecast, kind: "area" });
  return out;
};

function HorizonChartView({ rows, selected }: { rows: HorizonRow[]; selected: number }) {
  const data = useMemo<Row[]>(
    () =>
      rows.map((r) => ({
        horizon: r.horizon_hours,
        mae: r.metrics.mae_mw,
        band: r.p10_error_mw != null && r.p90_error_mw != null ? [r.p10_error_mw, r.p90_error_mw] : null,
      })),
    [rows],
  );
  const yTicks = useMemo(() => {
    const lows = rows.map((r) => r.p10_error_mw ?? 0);
    const highs = rows.flatMap((r) => [r.p90_error_mw ?? 0, r.metrics.mae_mw ?? 0]);
    return niceTicks(Math.min(0, ...lows), Math.max(0, ...highs));
  }, [rows]);

  return (
    <ResponsiveContainer width="100%" height={260}>
      <ComposedChart data={data} margin={{ top: 16, right: 8, bottom: 0, left: 0 }}>
        <CartesianGrid {...gridProps} />
        <XAxis
          dataKey="horizon"
          type="number"
          domain={[0, 48]}
          ticks={[0, 6, 12, 18, 24, 30, 36, 42, 48]}
          tickFormatter={(h: number) => `${h} h`}
          {...axisProps}
        />
        <YAxis ticks={yTicks} domain={[yTicks[0], yTicks[yTicks.length - 1]]} tickFormatter={formatGwTick} width={52} {...axisProps} />
        <Tooltip
          cursor={{ stroke: chartColors.grid }}
          content={<ChartTooltip<Row> title={(r) => `${r.horizon} h ahead`} lines={lines} />}
        />
        <Area dataKey="band" fill={chartColors.forecastRange} stroke="none" activeDot={false} isAnimationActive={false} />
        <Line dataKey="mae" stroke={chartColors.forecast} strokeWidth={2} dot={false} isAnimationActive={false} />
        <ReferenceLine
          x={selected}
          stroke={chartColors.forecast}
          strokeDasharray="3 3"
          label={{ value: "Selected", position: "top", fill: chartColors.forecast, fontSize: 12 }}
        />
      </ComposedChart>
    </ResponsiveContainer>
  );
}

export const HorizonChart = memo(HorizonChartView);
