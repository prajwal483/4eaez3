import { api } from "../api";
import { formatGwh, formatMw, formatUtc } from "../format";
import type { DecisionResponse } from "../types";
import { useAsync } from "../useAsync";
import { ChartLegend } from "./charts/ChartLegend";
import { DECISION_LEGEND, DecisionChart } from "./charts/DecisionChart";
import { Panel } from "./layout/Panel";
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

interface DecisionViewProps {
  deliveryDate: string;
  gateTime: string;
}

export function DecisionView({ deliveryDate, gateTime }: DecisionViewProps) {
  const decision = useAsync(() => api.decision(deliveryDate, gateTime), [deliveryDate, gateTime]);
  const d = decision.data;

  return (
    <section>
      {decision.error && <div className="error">{decision.error}</div>}
      {d && (
        <>
          <MetricCards cards={decisionCards(d)} />
          <Panel title="Wind forecast at gate closure vs outturn" legend={<ChartLegend items={DECISION_LEGEND} />}>
            <DecisionChart points={d.points} />
          </Panel>
        </>
      )}
    </section>
  );
}
