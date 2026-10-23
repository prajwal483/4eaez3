import type { ReactNode } from "react";
import { cx } from "../../cx";
import s from "./Panel.module.css";

interface PanelProps {
  title: string;
  subtitle?: string;
  legend?: ReactNode;
  children: ReactNode;
  className?: string;
}

export function Panel({ title, subtitle, legend, children, className }: PanelProps) {
  return (
    <section className={cx(s.panel, className)}>
      <header className={s.head}>
        <div>
          <h2 className={s.title}>{title}</h2>
          {subtitle && <p className={s.subtitle}>{subtitle}</p>}
        </div>
        {legend}
      </header>
      <div className={s.body}>{children}</div>
    </section>
  );
}
