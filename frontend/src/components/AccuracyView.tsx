import type { Meta } from "../types";

export function AccuracyView({ meta }: { meta: Meta }) {
  return <section className="muted">Accuracy analysis for horizons up to {meta.max_horizon_hours} h.</section>;
}
