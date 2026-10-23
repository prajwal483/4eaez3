import type { AccuracyResponse, DecisionResponse, HorizonRow, Meta } from "./types";

const BASE = "/api/v1";

interface ErrorEnvelope {
  error?: { code?: string; message?: string; request_id?: string };
}

async function getJson<T>(path: string, params: Record<string, string | number> = {}): Promise<T> {
  const qs = new URLSearchParams(Object.entries(params).map(([k, v]) => [k, String(v)])).toString();
  const res = await fetch(qs ? `${BASE}${path}?${qs}` : `${BASE}${path}`);
  const body = await res.json().catch(() => ({}));
  if (!res.ok) {
    throw new Error((body as ErrorEnvelope).error?.message ?? `Request failed: ${res.status}`);
  }
  return body as T;
}

export const api = {
  meta: () => getJson<Meta>("/meta"),
  decision: (deliveryDate: string, gateTime: string) =>
    getJson<DecisionResponse>("/decision", { delivery_date: deliveryDate, gate_time: gateTime }),
  accuracy: (horizon: number) => getJson<AccuracyResponse>("/accuracy", { horizon }),
  byHorizon: () => getJson<HorizonRow[]>("/accuracy/by-horizon"),
};
