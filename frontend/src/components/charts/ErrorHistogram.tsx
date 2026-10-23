import { memo, useMemo } from "react";
import { Bar, BarChart, CartesianGrid, Cell, ReferenceLine, ResponsiveContainer, Tooltip, XAxis, YAxis } from "recharts";
import { formatGwDelta, formatGwSigned } from "../../format";
import type { HistogramBin } from "../../types";
import { ChartTooltip, type TooltipLine } from "./ChartTooltip";
import { axisProps, chartColors, gridProps } from "./chartTheme";

interface BinRow {
  start: number;
  end: number;
  count: number;
}

const barColor = (r: BinRow): string => (r.start >= 0 ? chartColors.risk : chartColors.neutralBar);

const lines = (r: BinRow): TooltipLine[] => [{ label: "Hours", value: String(r.count), color: barColor(r), kind: "area" }];

function ErrorHistogramView({ bins }: { bins: HistogramBin[] }) {
  const rows = useMemo<BinRow[]>(
    () => bins.map((b) => ({ start: b.bin_start_mw, end: b.bin_end_mw, count: b.count })),
    [bins],
  );
  const xTicks = useMemo(() => rows.filter((r) => r.start % 1000 === 0).map((r) => r.start), [rows]);

  return (
    <ResponsiveContainer width="100%" height={260}>
      <BarChart data={rows} margin={{ top: 8, right: 8, bottom: 0, left: 0 }} barCategoryGap={1}>
        <CartesianGrid {...gridProps} />
        <XAxis dataKey="start" ticks={xTicks} interval={0} tickFormatter={formatGwSigned} {...axisProps} />
        <YAxis allowDecimals={false} width={36} {...axisProps} />
        <Tooltip
          cursor={{ fill: "rgba(28, 28, 26, 0.04)" }}
          content={
            <ChartTooltip<BinRow> title={(r) => `${formatGwDelta(r.start)} to ${formatGwDelta(r.end)}`} lines={lines} />
          }
        />
        <ReferenceLine x={0} stroke={chartColors.outturn} strokeWidth={1} />
        <Bar dataKey="count" isAnimationActive={false}>
          {rows.map((r) => (
            <Cell key={r.start} fill={barColor(r)} />
          ))}
        </Bar>
      </BarChart>
    </ResponsiveContainer>
  );
}

export const ErrorHistogram = memo(ErrorHistogramView);
