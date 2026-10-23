import { useMemo } from "react";
import { api } from "./api";
import s from "./App.module.css";
import { AccuracyView } from "./components/AccuracyView";
import { DayStepper } from "./components/controls/DayStepper";
import { GATE_OPTIONS } from "./components/controls/gateOptions";
import { HorizonSlider } from "./components/controls/HorizonSlider";
import { Select } from "./components/controls/Select";
import { DecisionView } from "./components/DecisionView";
import { TopBar } from "./components/layout/TopBar";
import { useQuery } from "./data/useQuery";
import { deliveryDates } from "./format";
import { useViewState } from "./state/useViewState";
import type { ViewLimits } from "./state/viewState";
import type { Meta } from "./types";

const DEFAULT_HORIZON_HOURS = 24;

function Dashboard({ meta }: { meta: Meta }) {
  const days = useMemo(() => deliveryDates(meta.first_delivery_date, meta.last_delivery_date), [meta]);
  const limits = useMemo<ViewLimits>(
    () => ({
      days,
      gates: GATE_OPTIONS.map((g) => g.value),
      maxHorizon: meta.max_horizon_hours,
      defaultGate: meta.default_gate_time_utc,
      defaultHorizon: DEFAULT_HORIZON_HOURS,
    }),
    [days, meta],
  );
  const [view, update] = useViewState(limits);

  const controls =
    view.tab === "decision" ? (
      <>
        <DayStepper days={days} value={view.day} onChange={(day) => update({ day })} />
        <Select
          label="Gate closure on D-1"
          hideLabel
          value={view.gate}
          options={GATE_OPTIONS}
          onChange={(gate) => update({ gate })}
        />
      </>
    ) : (
      <HorizonSlider value={view.horizon} max={meta.max_horizon_hours} onChange={(horizon) => update({ horizon })} />
    );

  return (
    <>
      <TopBar tab={view.tab} onTabChange={(tab) => update({ tab })} controls={controls} />
      <main className={s.main}>
        {view.tab === "decision" ? (
          <DecisionView deliveryDate={view.day} gateTime={view.gate} />
        ) : (
          <AccuracyView horizon={view.horizon} />
        )}
      </main>
      <footer className={s.footer}>
        Data: Elexon BMRS — FUELHH outturn (fuel type WIND) and WINDFOR forecasts, {meta.forecast_runs} forecast runs.
        All times UTC, which equals UK time in January.
      </footer>
    </>
  );
}

export default function App() {
  const meta = useQuery("meta", (signal) => api.meta(signal));
  if (meta.data) return <Dashboard meta={meta.data} />;
  return <div className={s.boot}>{meta.error ? meta.error.message : "Loading…"}</div>;
}
