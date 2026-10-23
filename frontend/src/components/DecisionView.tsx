import { api, errorReference } from "../api";
import { useQuery } from "../data/useQuery";
import { formatDayLong, formatHourUtc, formatWeekdayDay } from "../format";
import type { DecisionResponse } from "../types";
import { ChartLegend } from "./charts/ChartLegend";
import { DECISION_LEGEND, DecisionChart } from "./charts/DecisionChart";
import { SummaryRail } from "./decision/SummaryRail";
import s from "./DecisionView.module.css";
import { ErrorPanel } from "./feedback/ErrorPanel";
import { Skeleton } from "./feedback/Skeleton";
import { PageHeader } from "./layout/PageHeader";
import { Panel } from "./layout/Panel";

const TITLE = "Day-ahead decision";

export function decisionSummary(d: DecisionResponse): string {
  const gate = formatHourUtc(d.gate_closure);
  if (!d.forecast_published_at) return `No forecast was published before the ${gate} gate.`;
  const run = d.forecast_published_at;
  return `Forecast run ${formatHourUtc(run)} UTC on ${formatWeekdayDay(run)}, the latest before the ${gate} gate.`;
}

interface DecisionViewProps {
  deliveryDate: string;
  gateTime: string;
}

export function DecisionView({ deliveryDate, gateTime }: DecisionViewProps) {
  const decision = useQuery(`decision:${deliveryDate}:${gateTime}`, (signal) =>
    api.decision(deliveryDate, gateTime, signal),
  );
  const d = decision.data;

  if (decision.error) {
    return (
      <>
        <PageHeader title={TITLE} />
        <ErrorPanel
          message={`Couldn't load the forecast for ${formatDayLong(deliveryDate)}.`}
          reference={errorReference(decision.error)}
          onRetry={decision.reload}
        />
      </>
    );
  }

  if (!d) {
    return (
      <>
        <PageHeader title={TITLE} />
        <div className={s.layout}>
          <Skeleton height={420} />
          <div className={s.skeletonRail}>
            <Skeleton height={120} />
            <Skeleton height={200} />
          </div>
        </div>
      </>
    );
  }

  return (
    <>
      <PageHeader title={TITLE} description={decisionSummary(d)} status={decision.loading ? "Updating…" : undefined} />
      <div className={s.layout} aria-busy={decision.loading}>
        <Panel title="Wind forecast at gate closure vs outturn" legend={<ChartLegend items={DECISION_LEGEND} />}>
          <DecisionChart points={d.points} />
        </Panel>
        <SummaryRail decision={d} />
      </div>
    </>
  );
}
