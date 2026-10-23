import { Area, CartesianGrid, ComposedChart, Legend, Line, ResponsiveContainer, Tooltip, XAxis, YAxis } from "recharts";
import { api } from "../api";
import { formatGwh, formatHourUtc, formatMw, formatUtc } from "../format";
import type { DecisionResponse } from "../types";
import { useAsync } from "../useAsync";
import { type Card, MetricCards } from "./MetricCards";

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

interface DecisionViewProps {
  deliveryDate: string;
  gateTime: string;
}

export function DecisionView({ deliveryDate, gateTime }: DecisionViewProps) {
  const decision = useAsync(() => api.decision(deliveryDate, gateTime), [deliveryDate, gateTime]);
  const d = decision.data;

  const rows = d?.points.map((p) => ({
    time: formatHourUtc(p.start_time),
    forecast: p.forecast_mw,
    actual: p.actual_mw,
    band: p.low_mw != null && p.high_mw != null ? [p.low_mw, p.high_mw] : null,
  }));

  return (
    <section>
      {decision.error && <div className="error">{decision.error}</div>}
      {d && (
        <>
          <MetricCards cards={decisionCards(d)} />
          <div className="panel">
            <h2>Wind forecast available at gate closure vs outturn</h2>
            <p>
              Shaded band: likely range (P10–P90) based on errors from the last 14 days at each hour's own lead time,
              using only outturn published before gate closure.
            </p>
            <ResponsiveContainer width="100%" height={360}>
              <ComposedChart data={rows}>
                <CartesianGrid strokeDasharray="3 3" stroke="#e6e5e1" />
                <XAxis dataKey="time" />
                <YAxis tickFormatter={(v: number) => `${(v / 1000).toFixed(0)} GW`} />
                <Tooltip formatter={mwOrRange} />
                <Legend />
                <Area dataKey="band" name="Likely range (P10–P90)" fill="#93c5fd" stroke="none" fillOpacity={0.4} />
                <Line dataKey="forecast" name="Forecast" stroke="#1f5fbf" strokeWidth={2} dot={false} />
                <Line dataKey="actual" name="Actual" stroke="#3d3d3a" strokeWidth={2} dot={false} />
              </ComposedChart>
            </ResponsiveContainer>
          </div>
        </>
      )}
    </section>
  );
}
