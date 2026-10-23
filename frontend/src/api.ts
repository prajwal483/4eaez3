import type { AccuracyResponse, DecisionResponse, HorizonRow, Meta } from "./types";

async function getJson<T>(path: string, params: Record<string, string | number> = {}): Promise<T> {
  const qs = new URLSearchParams(Object.entries(params).map(([k, v]) => [k, String(v)])).toString();
  const res = await fetch(qs ? `${path}?${qs}` : path);
  const body = await res.json().catch(() => ({}));
  if (!res.ok) {
    throw new Error(typeof body.detail === "string" ? body.detail : `Request failed: ${res.status}`);
  }
  return body as T;
}

export const api = {
  meta: () => getJson<Meta>("/api/meta"),
  decision: (deliveryDate: string, gateHour: number) =>
    getJson<DecisionResponse>("/api/decision", { delivery_date: deliveryDate, gate_hour: gateHour }),
  accuracy: (horizon: number) => getJson<AccuracyResponse>("/api/accuracy", { horizon }),
  byHorizon: () => getJson<HorizonRow[]>("/api/accuracy/by-horizon"),
};
