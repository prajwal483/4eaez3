import type { Tab } from "../components/layout/TopBar";

export interface ViewState {
  tab: Tab;
  day: string;
  gate: string;
  horizon: number;
}

export interface ViewLimits {
  days: string[];
  gates: string[];
  maxHorizon: number;
  defaultGate: string;
  defaultHorizon: number;
}

/** Parse the URL query into a view, falling back to defaults for anything missing or out of range. */
export function readViewState(search: string, limits: ViewLimits): ViewState {
  const q = new URLSearchParams(search);
  const day = q.get("day") ?? "";
  const gate = q.get("gate") ?? "";
  const rawHorizon = q.get("h");
  const horizon = rawHorizon !== null && /^\d+$/.test(rawHorizon) ? Number(rawHorizon) : NaN;
  return {
    tab: q.get("tab") === "accuracy" ? "accuracy" : "decision",
    day: limits.days.includes(day) ? day : limits.days[0],
    gate: limits.gates.includes(gate) ? gate : limits.defaultGate,
    horizon: horizon >= 0 && horizon <= limits.maxHorizon ? horizon : limits.defaultHorizon,
  };
}

export function toSearch(state: ViewState): string {
  const q = new URLSearchParams({ tab: state.tab, day: state.day, gate: state.gate, h: String(state.horizon) });
  return `?${q.toString()}`;
}
