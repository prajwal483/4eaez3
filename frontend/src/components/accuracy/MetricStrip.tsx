import s from "./MetricStrip.module.css";

export interface Metric {
  label: string;
  value: string;
  note: string;
}

export function MetricStrip({ metrics }: { metrics: Metric[] }) {
  return (
    <dl className={s.strip}>
      {metrics.map((m) => (
        <div key={m.label} className={s.cell}>
          <dt className={s.label}>{m.label}</dt>
          <dd className={s.value}>{m.value}</dd>
          <dd className={s.note}>{m.note}</dd>
        </div>
      ))}
    </dl>
  );
}
