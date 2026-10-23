import { useState } from "react";
import {
  Area,
  Bar,
  BarChart,
  CartesianGrid,
  ComposedChart,
  Legend,
  Line,
  LineChart,
  ResponsiveContainer,
  Tooltip,
  XAxis,
  YAxis,
} from "recharts";
import { api } from "../api";
import { formatDayHourUtc, formatMw, formatPct } from "../format";
import type { Meta } from "../types";
import { useAsync } from "../useAsync";
import { MetricCards } from "./MetricCards";

const gw = (v: number) => `${(v / 1000).toFixed(0)} GW`;
const mwOrRange = (v: unknown): string =>
  Array.isArray(v) ? `${formatMw(v[0] as number)} – ${formatMw(v[1] as number)}` : formatMw(v as number);

export function AccuracyView({ meta }: { meta: Meta }) {
  const [horizon, setHorizon] = useState(24);
  const accuracy = useAsync(() => api.accuracy(horizon), [horizon]);
  const profile = useAsync(() => api.byHorizon(), []);
  const a = accuracy.data;
  const m = a?.metrics;

  const series = a?.points.map((p) => ({ time: formatDayHourUtc(p.start_time), forecast: p.forecast_mw, actual: p.actual_mw }));
  const bins = a?.histogram.map((b) => ({ label: `${(b.bin_start_mw / 1000).toFixed(2)} GW`, count: b.count }));
  const byHorizon = profile.data?.map((r) => ({
    horizon: r.horizon_hours,
    mae: r.metrics.mae_mw,
    band: r.p10_error_mw != null && r.p90_error_mw != null ? [r.p10_error_mw, r.p90_error_mw] : null,
  }));

  return (
    <section>
      <div className="controls">
        <label htmlFor="horizon">
          Forecast horizon: <strong>{horizon} h</strong> ahead
        </label>
        <input
          id="horizon"
          type="range"
          min={0}
          max={meta.max_horizon_hours}
          step={1}
          value={horizon}
          onChange={(e) => setHorizon(Number(e.target.value))}
        />
        <span className="muted">For every hour, uses the latest forecast published at least {horizon} h earlier.</span>
      </div>
      {accuracy.error && <div className="error">{accuracy.error}</div>}
      {m && (
        <MetricCards
          cards={[
            { label: "Mean absolute error", value: formatMw(m.mae_mw), hint: `${m.n} hourly samples` },
            { label: "RMSE", value: formatMw(m.rmse_mw), hint: "penalises large misses" },
            { label: "Bias", value: formatMw(m.bias_mw), hint: "positive = wind over-forecast" },
            { label: "WAPE", value: formatPct(m.wape_pct), hint: "absolute error as % of actual energy" },
            { label: "P90 absolute error", value: formatMw(m.p90_abs_mw), hint: "9 in 10 hours miss by less" },
          ]}
        />
      )}
      {a && (
        <div className="panel">
          <h2>Actual vs forecast — January 2026 delivery</h2>
          <p>Forecast shown is what was available {horizon} h before each hour.</p>
          <ResponsiveContainer width="100%" height={320}>
            <LineChart data={series}>
              <CartesianGrid strokeDasharray="3 3" stroke="#e2e8f0" />
              <XAxis dataKey="time" minTickGap={60} />
              <YAxis tickFormatter={gw} />
              <Tooltip formatter={mwOrRange} />
              <Legend />
              <Line dataKey="actual" name="Actual" stroke="#16a34a" dot={false} strokeWidth={1.5} />
              <Line dataKey="forecast" name="Forecast" stroke="#2563eb" dot={false} strokeWidth={1.5} />
            </LineChart>
          </ResponsiveContainer>
        </div>
      )}
      <div className="grid-2">
        {a && (
          <div className="panel">
            <h2>Error distribution</h2>
            <p>Forecast − actual, hourly. Right of zero means wind came in lower than forecast.</p>
            <ResponsiveContainer width="100%" height={260}>
              <BarChart data={bins}>
                <CartesianGrid strokeDasharray="3 3" stroke="#e2e8f0" />
                <XAxis dataKey="label" minTickGap={20} />
                <YAxis allowDecimals={false} />
                <Tooltip />
                <Bar dataKey="count" name="Hours" fill="#6366f1" />
              </BarChart>
            </ResponsiveContainer>
          </div>
        )}
        {byHorizon && (
          <div className="panel">
            <h2>How error grows with lead time</h2>
            <p>MAE and P10–P90 signed error by forecast horizon (hours before delivery).</p>
            <ResponsiveContainer width="100%" height={260}>
              <ComposedChart data={byHorizon}>
                <CartesianGrid strokeDasharray="3 3" stroke="#e2e8f0" />
                <XAxis dataKey="horizon" unit=" h" />
                <YAxis tickFormatter={gw} />
                <Tooltip formatter={mwOrRange} />
                <Legend />
                <Area dataKey="band" name="P10–P90 error" fill="#fcd34d" stroke="none" fillOpacity={0.5} />
                <Line dataKey="mae" name="MAE" stroke="#dc2626" strokeWidth={2} />
              </ComposedChart>
            </ResponsiveContainer>
          </div>
        )}
      </div>
    </section>
  );
}
