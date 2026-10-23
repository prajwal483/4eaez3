import type { SelectOption } from "./Select";

// GB day-ahead auctions since 2021; UK time equals UTC in January.
export const GATE_OPTIONS: SelectOption[] = [
  { value: "09:20", label: "Gate 09:20 · EPEX 60-min" },
  { value: "09:50", label: "Gate 09:50 · N2EX hourly" },
  { value: "15:30", label: "Gate 15:30 · EPEX 30-min" },
];
