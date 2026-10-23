import { useState } from "react";
import { api } from "./api";
import { AccuracyView } from "./components/AccuracyView";
import { DecisionView } from "./components/DecisionView";
import { useAsync } from "./useAsync";

type Tab = "decision" | "accuracy";

const TABS: { id: Tab; label: string }[] = [
  { id: "decision", label: "Day-ahead decision" },
  { id: "accuracy", label: "Forecast accuracy" },
];

export default function App() {
  const [tab, setTab] = useState<Tab>("decision");
  const meta = useAsync(() => api.meta(), []);

  return (
    <div className="app">
      <header className="header">
        <div>
          <h1>GridBrick · Wind Forecast Monitor</h1>
          <p className="subtitle">GB national wind generation · day-ahead buying decisions for January 2026</p>
        </div>
        <nav className="tabs">
          {TABS.map((t) => (
            <button key={t.id} aria-pressed={tab === t.id} onClick={() => setTab(t.id)}>
              {t.label}
            </button>
          ))}
        </nav>
      </header>
      <main>
        {meta.error && <div className="error">{meta.error}</div>}
        {meta.data && (tab === "decision" ? <DecisionView meta={meta.data} /> : <AccuracyView meta={meta.data} />)}
      </main>
      <footer>
        Data: Elexon BMRS — FUELHH (outturn, fuelType WIND) and WINDFOR (forecast). All times UTC (= UK time in
        January). {meta.data && `${meta.data.forecast_runs} forecast runs loaded from ${meta.data.data_source}.`}
      </footer>
    </div>
  );
}
