import { useState } from "react";
import { Area, CartesianGrid, ComposedChart, Legend, Line, ResponsiveContainer, Tooltip, XAxis, YAxis } from "recharts";
import { api } from "../api";
import { deliveryDates, formatGwh, formatHourUtc, formatMw, formatUtc } from "../format";
import type { DecisionResponse, Meta } from "../types";
import { useAsync } from "../useAsync";
import { type Card, MetricCards } from "./MetricCards";

const HOURS = Array.from({ length: 24 }, (_, h) => h);

function shortfallAtRiskMwh(d: DecisionResponse): number | null {
  // Energy to cover if wind lands at the low (P10) bound; points are hourly so summed MW are MWh.
  if (d.points.length === 0 || d.points.some((p) => p.low_mw == null)) return null;
  return d.points.reduce((sum, p) => sum + (p.forecast_mw - (p.low_mw as number)), 0);
}

function decisionCards(d: DecisionResponse): Card[] {
  const atRisk = shortfallAtRiskMwh(d);
  return [
    { label: "Forecast wind energy", value: formatGwh(d.forecast_energy_mwh), hint: `delivery day ${d.delivery_date}` },
    { label: "Latest forecast before gate", value: formatUtc(d.forecast_published_at), hint: `gate closure ${formatUtc(d.gate_closure)}` },
    {
      label: "Shortfall at risk (P10)",
      value: formatGwh(atRisk),
      hint: atRisk == null ? "not enough history for a range yet" : `from ${d.band_samples} recent forecast/actual pairs`,
    },
    {
      label: "Actual wind energy",
      value: formatGwh(d.actual_energy_mwh),
      hint: d.metrics.n > 0 ? `hourly MAE ${formatMw(d.metrics.mae_mw)}` : "outturn not yet available",
    },
  ];
}

const mwOrRange = (v: unknown): string =>
  Array.isArray(v) ? `${formatMw(v[0] as number)} – ${formatMw(v[1] as number)}` : formatMw(v as number);

export function DecisionView({ meta }: { meta: Meta }) {
  const [deliveryDate, setDeliveryDate] = useState(meta.first_delivery_date);
  const [gateHour, setGateHour] = useState(meta.default_gate_hour_utc);
  const decision = useAsync(() => api.decision(deliveryDate, gateHour), [deliveryDate, gateHour]);
  const d = decision.data;

  const rows = d?.points.map((p) => ({
    time: formatHourUtc(p.start_time),
    forecast: p.forecast_mw,
    actual: p.actual_mw,
    band: p.low_mw != null && p.high_mw != null ? [p.low_mw, p.high_mw] : null,
  }));

  return (
    <section>
      <div className="controls">
        <label>
          Delivery day{" "}
          <select value={deliveryDate} onChange={(e) => setDeliveryDate(e.target.value)}>
            {deliveryDates(meta.first_delivery_date, meta.last_delivery_date).map((day) => (
              <option key={day} value={day}>{day}</option>
            ))}
          </select>
        </label>
        <label>
          Gate closure on D-1{" "}
          <select value={gateHour} onChange={(e) => setGateHour(Number(e.target.value))}>
            {HOURS.map((h) => (
              <option key={h} value={h}>{`${String(h).padStart(2, "0")}:00 UTC`}</option>
            ))}
          </select>
        </label>
        {decision.loading && <span className="muted">Loading…</span>}
      </div>
      {decision.error && <div className="error">{decision.error}</div>}
      {d && (
        <>
          <MetricCards cards={decisionCards(d)} />
          <div className="panel">
            <h2>Wind forecast available at gate closure vs outturn</h2>
            <p>
              Shaded band: likely range (P10–P90) based on errors from the last 14 days at the same lead time,
              using only outturn published before gate closure.
            </p>
            <ResponsiveContainer width="100%" height={360}>
              <ComposedChart data={rows}>
                <CartesianGrid strokeDasharray="3 3" stroke="#e2e8f0" />
                <XAxis dataKey="time" />
                <YAxis tickFormatter={(v: number) => `${(v / 1000).toFixed(0)} GW`} />
                <Tooltip formatter={mwOrRange} />
                <Legend />
                <Area dataKey="band" name="Likely range (P10–P90)" fill="#93c5fd" stroke="none" fillOpacity={0.4} />
                <Line dataKey="forecast" name="Forecast" stroke="#2563eb" strokeWidth={2} dot={false} />
                <Line dataKey="actual" name="Actual" stroke="#16a34a" strokeWidth={2} dot={false} />
              </ComposedChart>
            </ResponsiveContainer>
          </div>
        </>
      )}
    </section>
  );
}
