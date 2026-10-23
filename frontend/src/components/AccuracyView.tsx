import { api } from "../api";
import { formatMw, formatPct } from "../format";
import type { Metrics } from "../types";
import { useAsync } from "../useAsync";
import { type Metric, MetricStrip } from "./accuracy/MetricStrip";
import s from "./AccuracyView.module.css";
import { AccuracySeriesChart } from "./charts/AccuracySeriesChart";
import { ChartLegend, type LegendItem } from "./charts/ChartLegend";
import { chartColors } from "./charts/chartTheme";
import { ErrorHistogram } from "./charts/ErrorHistogram";
import { HorizonChart } from "./charts/HorizonChart";
import { ErrorPanel } from "./feedback/ErrorPanel";
import { Skeleton } from "./feedback/Skeleton";
import { PageHeader } from "./layout/PageHeader";
import { Panel } from "./layout/Panel";

const TITLE = "Forecast accuracy";

const SERIES_LEGEND: LegendItem[] = [
  { label: "Forecast", color: chartColors.forecast, kind: "line" },
  { label: "Outturn", color: chartColors.outturn, kind: "dashed" },
];

const HISTOGRAM_LEGEND: LegendItem[] = [
  { label: "Wind below forecast", color: chartColors.risk, kind: "bar" },
  { label: "Wind above forecast", color: chartColors.neutralBar, kind: "bar" },
];

const HORIZON_LEGEND: LegendItem[] = [
  { label: "MAE", color: chartColors.forecast, kind: "line" },
  { label: "P10–P90 error", color: chartColors.forecastRangeKey, kind: "area" },
];

const accuracyMetrics = (m: Metrics): Metric[] => [
  { label: "Mean absolute error", value: formatMw(m.mae_mw), note: `${m.n} hourly samples` },
  { label: "RMSE", value: formatMw(m.rmse_mw), note: "Penalises large misses" },
  { label: "Bias", value: formatMw(m.bias_mw), note: "Positive: forecast above outturn" },
  { label: "WAPE", value: formatPct(m.wape_pct), note: "Absolute error as % of outturn" },
  { label: "P90 absolute error", value: formatMw(m.p90_abs_mw), note: "9 in 10 hours miss by less" },
];

export function AccuracyView({ horizon }: { horizon: number }) {
  const accuracy = useAsync(() => api.accuracy(horizon), [horizon]);
  const profile = useAsync(() => api.byHorizon(), []);
  const a = accuracy.data;
  const description = `Forecast available at least ${horizon} h before each hour, January 2026 delivery.`;

  if (accuracy.error) {
    return (
      <>
        <PageHeader title={TITLE} />
        <ErrorPanel message={`Couldn't load accuracy for the ${horizon} h horizon.`} onRetry={accuracy.reload} />
      </>
    );
  }

  if (!a) {
    return (
      <>
        <PageHeader title={TITLE} description={description} />
        <div className={s.content}>
          <Skeleton height={96} />
          <Skeleton height={360} />
        </div>
      </>
    );
  }

  return (
    <>
      <PageHeader title={TITLE} description={description} status={accuracy.loading ? "Updating…" : undefined} />
      <div className={s.content} aria-busy={accuracy.loading}>
        <MetricStrip metrics={accuracyMetrics(a.metrics)} />
        <Panel title="Actual vs forecast" legend={<ChartLegend items={SERIES_LEGEND} />}>
          <AccuracySeriesChart points={a.points} />
        </Panel>
        <div className={s.row}>
          <Panel
            title="Error distribution"
            subtitle="Forecast minus outturn, hourly"
            legend={<ChartLegend items={HISTOGRAM_LEGEND} />}
          >
            <ErrorHistogram bins={a.histogram} />
          </Panel>
          <Panel
            title="How error grows with lead time"
            subtitle="By hours ahead of delivery"
            legend={<ChartLegend items={HORIZON_LEGEND} />}
          >
            {profile.data ? <HorizonChart rows={profile.data} selected={horizon} /> : <Skeleton height={260} />}
          </Panel>
        </div>
      </div>
    </>
  );
}
