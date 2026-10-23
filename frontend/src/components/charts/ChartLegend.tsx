import type { CSSProperties } from "react";
import s from "./ChartLegend.module.css";

export interface LegendItem {
  label: string;
  color: string;
  kind: "line" | "dashed" | "area" | "dot" | "bar";
}

export function ChartLegend({ items }: { items: LegendItem[] }) {
  return (
    <ul className={s.legend}>
      {items.map((item) => (
        <li key={item.label}>
          <span className={s.key} data-kind={item.kind} style={{ "--key": item.color } as CSSProperties} />
          {item.label}
        </li>
      ))}
    </ul>
  );
}
