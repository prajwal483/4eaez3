import type { AccuracyResponse, DecisionResponse, ErrorResponse, HorizonRow, Meta } from "./types";

const BASE = "/api/v1";

/** A failed API call, carrying the server's error code and request id for support. */
export class ApiError extends Error {
  constructor(
    message: string,
    readonly status: number,
    readonly code?: string,
    readonly requestId?: string,
  ) {
    super(message);
    this.name = "ApiError";
  }
}

async function getJson<T>(path: string, params: Record<string, string | number>, signal?: AbortSignal): Promise<T> {
  const qs = new URLSearchParams(Object.entries(params).map(([k, v]) => [k, String(v)])).toString();
  const res = await fetch(qs ? `${BASE}${path}?${qs}` : `${BASE}${path}`, { signal });
  const body: unknown = await res.json().catch(() => null);
  if (!res.ok) {
    const error = (body as Partial<ErrorResponse> | null)?.error;
    throw new ApiError(
      error?.message ?? `Request failed: ${res.status}`,
      res.status,
      error?.code,
      error?.request_id ?? undefined,
    );
  }
  return body as T;
}

export const api = {
  meta: (signal?: AbortSignal) => getJson<Meta>("/meta", {}, signal),
  decision: (deliveryDate: string, gateTime: string, signal?: AbortSignal) =>
    getJson<DecisionResponse>("/decision", { delivery_date: deliveryDate, gate_time: gateTime }, signal),
  accuracy: (horizon: number, signal?: AbortSignal) => getJson<AccuracyResponse>("/accuracy", { horizon }, signal),
  byHorizon: (signal?: AbortSignal) => getJson<HorizonRow[]>("/accuracy/by-horizon", {}, signal),
};

export const errorReference = (error: Error | null): string | undefined =>
  error instanceof ApiError ? error.requestId : undefined;
