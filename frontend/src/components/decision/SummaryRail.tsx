import { formatDayHour, formatGwh, formatMw } from "../../format";
import type { DecisionResponse } from "../../types";
import { shortfallAtRiskMwh } from "./shortfall";
import s from "./SummaryRail.module.css";

export function SummaryRail({ decision: d }: { decision: DecisionResponse }) {
  const atRisk = shortfallAtRiskMwh(d);
  return (
    <aside className={s.rail} aria-label="Decision summary">
      {d.points.length === 0 ? (
        <p className={s.noRange}>No forecast was published for this day before the gate.</p>
      ) : atRisk == null ? (
        <p className={s.noRange}>Not enough history yet for a likely range.</p>
      ) : (
        <div className={s.risk}>
          <div className={s.riskLabel}>Shortfall at risk (P10)</div>
          <div className={s.riskValue}>{formatGwh(atRisk)}</div>
          <p className={s.riskCaption}>
            Extra energy to cover if wind lands at the low end of its range. Based on {d.band_samples} recent
            forecast and outturn pairs.
          </p>
        </div>
      )}
      <dl className={s.figures}>
        <div>
          <dt>Forecast wind energy</dt>
          <dd>{formatGwh(d.forecast_energy_mwh)}</dd>
        </div>
        <div>
          <dt>Outturn energy</dt>
          <dd>
            {d.actual_energy_mwh == null ? (
              <span className={s.missing}>Outturn not yet available</span>
            ) : (
              formatGwh(d.actual_energy_mwh)
            )}
          </dd>
        </div>
        <div>
          <dt>Hourly MAE</dt>
          <dd>{d.metrics.n > 0 ? formatMw(d.metrics.mae_mw) : "—"}</dd>
        </div>
      </dl>
      <dl className={s.meta}>
        <div>
          <dt>Forecast run</dt>
          <dd>{d.forecast_published_at ? `${formatDayHour(d.forecast_published_at)} UTC` : "None before gate"}</dd>
        </div>
        <div>
          <dt>Gate closure</dt>
          <dd>{formatDayHour(d.gate_closure)} UTC</dd>
        </div>
        <div>
          <dt>Range samples</dt>
          <dd>{d.band_samples}</dd>
        </div>
      </dl>
    </aside>
  );
}
