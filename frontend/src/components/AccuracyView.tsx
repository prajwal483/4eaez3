import { api, errorReference } from "../api";
import { useQuery } from "../data/useQuery";
import { formatMw, formatPct } from "../format";
import { useDebouncedValue } from "../hooks/useDebouncedValue";
import type { Metrics } from "../types";
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
  // The slider moves every frame; only fetch once the user pauses.
  const requested = useDebouncedValue(horizon, 150);
  const accuracy = useQuery(`accuracy:${requested}`, (signal) => api.accuracy(requested, signal));
  const profile = useQuery("accuracy-by-horizon", (signal) => api.byHorizon(signal));
  const a = accuracy.data;
  const updating = accuracy.loading || requested !== horizon;
  const description = `Forecast available at least ${requested} h before each hour, January 2026 delivery.`;

  if (accuracy.error) {
    return (
      <>
        <PageHeader title={TITLE} />
        <ErrorPanel
          message={`Couldn't load accuracy for the ${requested} h horizon.`}
          reference={errorReference(accuracy.error)}
          onRetry={accuracy.reload}
        />
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
      <PageHeader title={TITLE} description={description} status={updating ? "Updating…" : undefined} />
      <div className={s.content} aria-busy={updating}>
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
