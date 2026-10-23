import s from "./ChartTooltip.module.css";

export interface TooltipLine {
  label: string;
  value: string;
  color: string;
  kind?: "line" | "dashed" | "area";
}

interface ChartTooltipProps<T> {
  active?: boolean;
  payload?: ReadonlyArray<{ payload?: T }>;
  title: (row: T) => string;
  lines: (row: T) => TooltipLine[];
}

export function ChartTooltip<T>({ active, payload, title, lines }: ChartTooltipProps<T>) {
  const row = payload?.[0]?.payload;
  if (!active || !row) return null;
  return (
    <div className={s.tooltip}>
      <div className={s.title}>{title(row)}</div>
      {lines(row).map((l) => (
        <div key={l.label} className={s.line}>
          <span className={s.swatch} data-kind={l.kind ?? "line"} style={{ color: l.color }} />
          <span className={s.label}>{l.label}</span>
          <span className={s.value}>{l.value}</span>
        </div>
      ))}
    </div>
  );
}
