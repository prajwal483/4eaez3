import type { ReactNode } from "react";
import { WindMark } from "../icons";
import s from "./TopBar.module.css";

export type Tab = "decision" | "accuracy";

const TABS: { id: Tab; label: string }[] = [
  { id: "decision", label: "Day-ahead decision" },
  { id: "accuracy", label: "Forecast accuracy" },
];

interface TopBarProps {
  tab: Tab;
  onTabChange: (tab: Tab) => void;
  controls?: ReactNode;
}

export function TopBar({ tab, onTabChange, controls }: TopBarProps) {
  return (
    <header className={s.bar}>
      <div className={s.inner}>
        <div className={s.brand}>
          <WindMark className={s.mark} />
          <span>GridBrick</span>
        </div>
        <nav className={s.tabs} aria-label="Views">
          {TABS.map((t) => (
            <button
              key={t.id}
              type="button"
              className={s.tab}
              aria-current={tab === t.id ? "page" : undefined}
              onClick={() => onTabChange(t.id)}
            >
              {t.label}
            </button>
          ))}
        </nav>
        {controls && <div className={s.controls}>{controls}</div>}
      </div>
    </header>
  );
}
