import { useMemo, useState } from "react";
import { api } from "./api";
import s from "./App.module.css";
import { AccuracyView } from "./components/AccuracyView";
import { DayStepper } from "./components/controls/DayStepper";
import { GATE_OPTIONS } from "./components/controls/gateOptions";
import { HorizonSlider } from "./components/controls/HorizonSlider";
import { Select } from "./components/controls/Select";
import { DecisionView } from "./components/DecisionView";
import { type Tab, TopBar } from "./components/layout/TopBar";
import { deliveryDates } from "./format";
import type { Meta } from "./types";
import { useAsync } from "./useAsync";

const DEFAULT_HORIZON_HOURS = 24;

function Dashboard({ meta }: { meta: Meta }) {
  const [tab, setTab] = useState<Tab>("decision");
  const days = useMemo(() => deliveryDates(meta.first_delivery_date, meta.last_delivery_date), [meta]);
  const [deliveryDate, setDeliveryDate] = useState(meta.first_delivery_date);
  const [gateTime, setGateTime] = useState(meta.default_gate_time_utc);
  const [horizon, setHorizon] = useState(DEFAULT_HORIZON_HOURS);

  const controls =
    tab === "decision" ? (
      <>
        <DayStepper days={days} value={deliveryDate} onChange={setDeliveryDate} />
        <Select label="Gate closure on D-1" hideLabel value={gateTime} options={GATE_OPTIONS} onChange={setGateTime} />
      </>
    ) : (
      <HorizonSlider value={horizon} max={meta.max_horizon_hours} onChange={setHorizon} />
    );

  return (
    <>
      <TopBar tab={tab} onTabChange={setTab} controls={controls} />
      <main className={s.main}>
        {tab === "decision" ? (
          <DecisionView deliveryDate={deliveryDate} gateTime={gateTime} />
        ) : (
          <AccuracyView horizon={horizon} />
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
  const meta = useAsync(() => api.meta(), []);
  if (meta.data) return <Dashboard meta={meta.data} />;
  return <div className={s.boot}>{meta.error ?? "Loading…"}</div>;
}
