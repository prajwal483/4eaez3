# UI Redesign Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Restyle and re-lay-out the GridBrick frontend so it reads as a designed product. The spec is `docs/superpowers/specs/2026-10-23-ui-redesign-design.md`. Data, API and features stay the same.

**Architecture:**
- Design tokens live in CSS custom properties (`styles/tokens.css`). Components style themselves with Vite CSS modules.
- `App` owns page state and renders a `TopBar` whose right-hand slot holds the active page's controls. Views receive their inputs as props.
- Charts stay on Recharts, but go through a shared theme, a round-tick helper, and a custom tooltip and legend.

**Tech Stack:** React 18, TypeScript 5.6, Vite 5 (CSS modules), Recharts 2, Vitest + Testing Library, `@fontsource/ibm-plex-sans`.

## Global Constraints

- Light theme only. Font: IBM Plex Sans (400 and 500), self-hosted via `@fontsource/ibm-plex-sans`. Tabular figures everywhere.
- Type scale: 12, 13, 14, 16, 20, 28 px. Two weights: 400 and 500. Sentence case, no uppercase labels.
- Colours come only from the tokens in `tokens.css`; the chart code mirrors them in `chartTheme.ts`. Use: forecast `#1f5fbf`, range `rgba(31, 95, 191, 0.12)`, outturn `#3d3d3a` dashed, risk `#b45309`.
- Spacing is on a 4 px grid. Radius is 6 px for controls and 10 px for panels. No pills. The only shadow is on the chart tooltip.
- No Recharts `<Legend>`. Every series sets `isAnimationActive={false}`. Gridlines are horizontal only, with no axis or tick lines.
- No backend or API changes. No dark mode.
- **After every task:** run tests and build, commit, `git push origin main`, `npx vercel deploy --prod --yes` (from the repo root), then check https://4eaez3.vercel.app.
- Commands run from `frontend/` unless stated otherwise. Shell: Git Bash on Windows.

## File structure (end state)

```
frontend/src/
  main.tsx                     imports font, tokens, base CSS
  vite-env.d.ts                Vite client types (CSS modules)
  cx.ts                        className join helper
  styles/tokens.css            design tokens
  styles/base.css              reset, body type, focus ring, .visually-hidden
  App.tsx, App.module.css      boot + Dashboard (page state, TopBar, footer)
  format.ts                    + day/time and GW formatters
  useAsync.ts                  + reload(), keeps data while refetching
  components/
    icons.tsx                  WindMark, ChevronDown/Left/Right
    layout/TopBar.tsx|.module.css
    layout/Panel.tsx|.module.css
    layout/PageHeader.tsx|.module.css
    controls/Select.tsx|.module.css
    controls/DayStepper.tsx|.module.css
    controls/HorizonSlider.tsx|.module.css
    controls/gateOptions.ts
    feedback/ErrorPanel.tsx|.module.css
    feedback/Skeleton.tsx|.module.css
    charts/chartTheme.ts, ticks.ts, decisionSeries.ts
    charts/ChartTooltip.tsx|.module.css, ChartLegend.tsx|.module.css
    charts/DecisionChart.tsx, AccuracySeriesChart.tsx, ErrorHistogram.tsx, HorizonChart.tsx
    decision/shortfall.ts, SummaryRail.tsx|.module.css
    accuracy/MetricStrip.tsx|.module.css
    DecisionView.tsx|.module.css, AccuracyView.tsx|.module.css
```

Removed by the end: `src/index.css`, `src/components/MetricCards.tsx`.

---

### Task 1: Design tokens, font, base styles and formatters

**Files:**
- Create: `frontend/src/styles/tokens.css`, `frontend/src/styles/base.css`, `frontend/src/vite-env.d.ts`, `frontend/src/cx.ts`
- Replace: `frontend/src/main.tsx`, `frontend/src/index.css` (temporary legacy classes, now token-based), `frontend/src/format.ts`, `frontend/src/format.test.ts`
- Modify: `frontend/package.json` (via npm install)

**Interfaces:**
- Produces:
  - CSS variables, as named in `tokens.css`, and the `.visually-hidden` class.
  - `cx(...classes: (string | false | null | undefined)[]): string`
  - In `format.ts`:
    - `formatWeekdayDay(iso: string): string` → "Thu 15 Jan"
    - `formatDayLong(iso: string): string` → "Thu 15 Jan 2026"
    - `formatDayHour(iso: string): string` → "Thu 15 Jan, 14:00"
    - `formatDayShort(iso: string): string` → "5 Jan"
    - `formatGw(mw: number | null | undefined): string` → "15.8 GW"
    - `formatGwRange(lowMw: number, highMw: number): string` → "11.0–16.6 GW"
    - `formatGwDelta(mw: number | null | undefined): string` → "+1.2 GW"
    - `formatGwTick(mw: number): string` → "5 GW"
    - `formatGwSigned(mw: number): string` → "+1"
  - Existing exports keep working: `formatMw`, `formatGwh`, `formatPct`, `formatUtc`, `formatHourUtc`, `formatDayHourUtc`, `deliveryDates`.

- [ ] **Step 1: Install the font**

Run: `npm install @fontsource/ibm-plex-sans@^5`
Expected: `package.json` gains `"@fontsource/ibm-plex-sans"` under dependencies.

- [ ] **Step 2: Write the failing formatter tests**

**`frontend/src/format.test.ts`** (replace)
```ts
import {
  deliveryDates,
  formatDayHour,
  formatDayHourUtc,
  formatDayLong,
  formatDayShort,
  formatGw,
  formatGwDelta,
  formatGwh,
  formatGwRange,
  formatGwSigned,
  formatGwTick,
  formatHourUtc,
  formatMw,
  formatPct,
  formatUtc,
  formatWeekdayDay,
} from "./format";

describe("format", () => {
  it("formats MW with thousands separators", () => {
    expect(formatMw(12345.6)).toBe("12,346 MW");
    expect(formatMw(null)).toBe("—");
  });
  it("formats MWh as GWh", () => {
    expect(formatGwh(31080)).toBe("31.1 GWh");
    expect(formatGwh(null)).toBe("—");
  });
  it("formats percentages", () => {
    expect(formatPct(6.25)).toBe("6.3%");
  });
  it("formats UTC timestamps", () => {
    expect(formatUtc("2026-01-02T06:00:00Z")).toBe("2026-01-02 06:00 UTC");
    expect(formatUtc(null)).toBe("—");
    expect(formatHourUtc("2026-01-02T06:00:00Z")).toBe("06:00");
    expect(formatDayHourUtc("2026-01-02T06:00:00Z")).toBe("02 Jan 06:00");
  });
  it("lists delivery dates inclusively", () => {
    expect(deliveryDates("2026-01-30", "2026-02-01")).toEqual(["2026-01-30", "2026-01-31", "2026-02-01"]);
  });
  it("formats days in words", () => {
    expect(formatWeekdayDay("2026-01-15")).toBe("Thu 15 Jan");
    expect(formatDayLong("2026-01-15")).toBe("Thu 15 Jan 2026");
    expect(formatDayLong("2026-01-02")).toBe("Fri 2 Jan 2026");
    expect(formatDayHour("2026-01-15T14:00:00Z")).toBe("Thu 15 Jan, 14:00");
    expect(formatDayShort("2026-01-05T00:00:00Z")).toBe("5 Jan");
  });
  it("formats GW values with a true minus sign", () => {
    expect(formatGw(15834)).toBe("15.8 GW");
    expect(formatGw(-500)).toBe("−0.5 GW");
    expect(formatGw(null)).toBe("—");
    expect(formatGwRange(11002, 16562)).toBe("11.0–16.6 GW");
    expect(formatGwRange(-900, 4500)).toBe("−0.9–4.5 GW");
    expect(formatGwDelta(1200)).toBe("+1.2 GW");
    expect(formatGwDelta(-1200)).toBe("−1.2 GW");
    expect(formatGwDelta(null)).toBe("—");
  });
  it("formats axis ticks and bin labels", () => {
    expect(formatGwTick(0)).toBe("0 GW");
    expect(formatGwTick(5000)).toBe("5 GW");
    expect(formatGwTick(2500)).toBe("2.5 GW");
    expect(formatGwTick(-2000)).toBe("−2 GW");
    expect(formatGwSigned(-1000)).toBe("−1");
    expect(formatGwSigned(0)).toBe("0");
    expect(formatGwSigned(1000)).toBe("+1");
    expect(formatGwSigned(250)).toBe("+0.25");
  });
});
```

- [ ] **Step 3: Run tests to verify they fail**

Run: `npx vitest run src/format.test.ts`
Expected: FAIL. The new formatter names aren't exported yet.

- [ ] **Step 4: Write the implementation and styles**

**`frontend/src/format.ts`** (replace)
```ts
const DASH = "—";
const MINUS = "−";
const MONTHS = ["Jan", "Feb", "Mar", "Apr", "May", "Jun", "Jul", "Aug", "Sep", "Oct", "Nov", "Dec"];
const WEEKDAYS = ["Sun", "Mon", "Tue", "Wed", "Thu", "Fri", "Sat"];

const toDate = (iso: string): Date => new Date(iso.length === 10 ? `${iso}T00:00:00Z` : iso);

export const formatMw = (v: number | null | undefined): string =>
  v == null ? DASH : `${Math.round(v).toLocaleString("en-GB")} MW`;

export const formatGwh = (mwh: number | null | undefined): string =>
  mwh == null ? DASH : `${(mwh / 1000).toFixed(1)} GWh`;

export const formatPct = (v: number | null | undefined): string => (v == null ? DASH : `${v.toFixed(1)}%`);

export function formatUtc(iso: string | null | undefined): string {
  if (!iso) return DASH;
  const s = new Date(iso).toISOString();
  return `${s.slice(0, 10)} ${s.slice(11, 16)} UTC`;
}

export const formatHourUtc = (iso: string): string => new Date(iso).toISOString().slice(11, 16);

export function formatDayHourUtc(iso: string): string {
  const d = new Date(iso);
  const day = String(d.getUTCDate()).padStart(2, "0");
  return `${day} ${MONTHS[d.getUTCMonth()]} ${d.toISOString().slice(11, 16)}`;
}

export function formatWeekdayDay(iso: string): string {
  const d = toDate(iso);
  return `${WEEKDAYS[d.getUTCDay()]} ${d.getUTCDate()} ${MONTHS[d.getUTCMonth()]}`;
}

export const formatDayLong = (iso: string): string => `${formatWeekdayDay(iso)} ${toDate(iso).getUTCFullYear()}`;

export const formatDayHour = (iso: string): string => `${formatWeekdayDay(iso)}, ${formatHourUtc(toDate(iso).toISOString())}`;

export function formatDayShort(iso: string): string {
  const d = toDate(iso);
  return `${d.getUTCDate()} ${MONTHS[d.getUTCMonth()]}`;
}

function gwNumber(mw: number, digits = 1): string {
  const text = Math.abs(mw / 1000).toFixed(digits);
  return mw < 0 && Number(text) !== 0 ? `${MINUS}${text}` : text;
}

export const formatGw = (mw: number | null | undefined): string => (mw == null ? DASH : `${gwNumber(mw)} GW`);

export const formatGwRange = (lowMw: number, highMw: number): string => `${gwNumber(lowMw)}–${gwNumber(highMw)} GW`;

export function formatGwDelta(mw: number | null | undefined): string {
  if (mw == null) return DASH;
  return mw > 0 ? `+${gwNumber(mw)} GW` : `${gwNumber(mw)} GW`;
}

export function formatGwTick(mw: number): string {
  const gw = Number((mw / 1000).toFixed(1));
  return `${gw < 0 ? MINUS : ""}${Math.abs(gw)} GW`;
}

export function formatGwSigned(mw: number): string {
  const gw = Number((mw / 1000).toFixed(2));
  if (gw === 0) return "0";
  return `${gw > 0 ? "+" : MINUS}${Math.abs(gw)}`;
}

export function deliveryDates(first: string, last: string): string[] {
  const out: string[] = [];
  const d = new Date(`${first}T00:00:00Z`);
  const end = new Date(`${last}T00:00:00Z`);
  while (d <= end) {
    out.push(d.toISOString().slice(0, 10));
    d.setUTCDate(d.getUTCDate() + 1);
  }
  return out;
}
```

**`frontend/src/styles/tokens.css`** (create)
```css
:root {
  --bg: #ffffff;
  --surface: #f7f7f5;
  --border: #e6e5e1;
  --border-strong: #d3d1c9;
  --text: #1c1c1a;
  --text-2: #5f5e5a;
  --text-3: #8a8984;
  --forecast: #1f5fbf;
  --forecast-range: rgba(31, 95, 191, 0.12);
  --outturn: #3d3d3a;
  --risk: #b45309;
  --risk-bg: #fdf3e7;
  --neutral-bar: #b4b2a9;
  --danger: #a32d2d;
  --danger-bg: #fcebeb;

  --font-sans: "IBM Plex Sans", system-ui, -apple-system, "Segoe UI", sans-serif;
  --text-xs: 12px;
  --text-sm: 13px;
  --text-md: 14px;
  --text-lg: 16px;
  --text-xl: 20px;
  --text-2xl: 28px;

  --space-1: 4px;
  --space-2: 8px;
  --space-3: 12px;
  --space-4: 16px;
  --space-5: 20px;
  --space-6: 24px;
  --space-7: 32px;
  --space-8: 40px;

  --radius-control: 6px;
  --radius-panel: 10px;
  --shadow-tooltip: 0 4px 16px rgba(28, 28, 26, 0.08), 0 1px 3px rgba(28, 28, 26, 0.06);
  --content-width: 1200px;
}
```

**`frontend/src/styles/base.css`** (create)
```css
*,
*::before,
*::after {
  box-sizing: border-box;
}
body {
  margin: 0;
  background: var(--bg);
  color: var(--text);
  font-family: var(--font-sans);
  font-size: var(--text-md);
  line-height: 1.5;
  font-variant-numeric: tabular-nums;
  -webkit-font-smoothing: antialiased;
}
h1,
h2,
h3,
p {
  margin: 0;
}
h1,
h2,
h3 {
  font-weight: 500;
}
button,
select,
input {
  font: inherit;
  color: inherit;
}
:focus-visible {
  outline: 2px solid var(--forecast);
  outline-offset: 2px;
}
.visually-hidden {
  position: absolute;
  width: 1px;
  height: 1px;
  padding: 0;
  margin: -1px;
  overflow: hidden;
  clip: rect(0 0 0 0);
  white-space: nowrap;
  border: 0;
}
```

**`frontend/src/index.css`** (replace; legacy classes kept until Task 5, now on tokens)
```css
.app { max-width: var(--content-width); margin: 0 auto; padding: var(--space-6); }
.header { display: flex; justify-content: space-between; align-items: flex-end; gap: var(--space-4); flex-wrap: wrap; margin-bottom: var(--space-5); }
.header h1 { font-size: var(--text-xl); }
.subtitle { margin-top: var(--space-1); color: var(--text-2); }
.tabs { display: flex; gap: var(--space-2); }
.tabs button { border: 1px solid var(--border-strong); background: var(--bg); padding: var(--space-2) var(--space-4); border-radius: var(--radius-control); cursor: pointer; color: var(--text-2); }
.tabs button[aria-pressed="true"] { color: var(--text); border-color: var(--forecast); }
.controls { display: flex; gap: var(--space-4); align-items: center; flex-wrap: wrap; margin-bottom: var(--space-4); }
.cards { display: grid; grid-template-columns: repeat(auto-fit, minmax(190px, 1fr)); gap: var(--space-3); margin-bottom: var(--space-4); }
.card { background: var(--bg); border: 1px solid var(--border); border-radius: var(--radius-panel); padding: var(--space-4); }
.card-label { font-size: var(--text-sm); color: var(--text-2); }
.card-value { font-size: var(--text-xl); font-weight: 500; margin-top: var(--space-1); }
.card-hint { font-size: var(--text-xs); color: var(--text-3); margin-top: var(--space-1); }
.panel { background: var(--bg); border: 1px solid var(--border); border-radius: var(--radius-panel); padding: var(--space-4); margin-bottom: var(--space-4); }
.panel h2 { font-size: var(--text-lg); margin-bottom: var(--space-1); }
.panel p { margin-bottom: var(--space-3); color: var(--text-2); font-size: var(--text-sm); }
.grid-2 { display: grid; grid-template-columns: repeat(auto-fit, minmax(420px, 1fr)); gap: var(--space-4); }
.muted { color: var(--text-3); font-size: var(--text-sm); }
.error { background: var(--danger-bg); color: var(--danger); padding: var(--space-3); border-radius: var(--radius-control); margin-bottom: var(--space-4); }
footer { color: var(--text-3); font-size: var(--text-xs); margin-top: var(--space-6); }
```

**`frontend/src/main.tsx`** (replace)
```tsx
import "@fontsource/ibm-plex-sans/400.css";
import "@fontsource/ibm-plex-sans/500.css";
import { StrictMode } from "react";
import { createRoot } from "react-dom/client";
import App from "./App";
import "./styles/tokens.css";
import "./styles/base.css";
import "./index.css";

createRoot(document.getElementById("root")!).render(
  <StrictMode>
    <App />
  </StrictMode>,
);
```

**`frontend/src/vite-env.d.ts`** (create)
```ts
/// <reference types="vite/client" />
```

**`frontend/src/cx.ts`** (create)
```ts
export const cx = (...classes: (string | false | null | undefined)[]): string => classes.filter(Boolean).join(" ");
```

- [ ] **Step 5: Run tests and build**

Run: `npm test && npm run build`
Expected: all tests pass and the build succeeds.

- [ ] **Step 6: Commit, push, deploy, check**

```bash
git add package.json package-lock.json src
git commit -m "feat(ui): add design tokens, IBM Plex Sans and day/GW formatters"
git push origin main
cd .. && npx vercel deploy --prod --yes && cd frontend
```
Check https://4eaez3.vercel.app: the page uses IBM Plex Sans and the token colours. The layout is unchanged.

---

### Task 2: App shell — top bar, controls, page state in App

**Files:**
- Create: `frontend/src/components/icons.tsx`, `frontend/src/components/layout/TopBar.tsx`, `frontend/src/components/layout/TopBar.module.css`, `frontend/src/components/controls/Select.tsx`, `frontend/src/components/controls/Select.module.css`, `frontend/src/components/controls/DayStepper.tsx`, `frontend/src/components/controls/DayStepper.module.css`, `frontend/src/components/controls/HorizonSlider.tsx`, `frontend/src/components/controls/HorizonSlider.module.css`, `frontend/src/components/controls/gateOptions.ts`, `frontend/src/App.module.css`
- Replace: `frontend/src/App.tsx`, `frontend/src/components/DecisionView.tsx`, `frontend/src/components/AccuracyView.tsx`
- Tests (replace/create): `frontend/src/App.test.tsx`, `frontend/src/components/DecisionView.test.tsx`, `frontend/src/components/AccuracyView.test.tsx`, `frontend/src/components/controls/DayStepper.test.tsx`

**Interfaces:**
- Consumes: `formatDayLong`, `deliveryDates`, `cx` (Task 1).
- Produces:
  - Layout:
    - `type Tab = "decision" | "accuracy"`
    - `TopBar({ tab: Tab; onTabChange: (tab: Tab) => void; controls?: ReactNode })`
  - Controls:
    - `Select({ label: string; value: string; options: SelectOption[]; onChange: (value: string) => void; hideLabel?: boolean })`, with `SelectOption = { value: string; label: string }`
    - `DayStepper({ days: string[]; value: string; onChange: (day: string) => void })`
    - `HorizonSlider({ value: number; max: number; onChange: (hours: number) => void })`
    - `GATE_OPTIONS: SelectOption[]`
  - Views:
    - `DecisionView({ deliveryDate: string; gateTime: string })`
    - `AccuracyView({ horizon: number })`
  - Icons: `WindMark`, `ChevronDown`, `ChevronLeft`, `ChevronRight` (each takes `{ className?: string }`).

- [ ] **Step 1: Write the failing tests**

**`frontend/src/components/controls/DayStepper.test.tsx`** (create)
```tsx
import { fireEvent, render, screen } from "@testing-library/react";
import { DayStepper } from "./DayStepper";

const days = ["2026-01-02", "2026-01-03", "2026-01-04"];

describe("DayStepper", () => {
  it("steps forward and back", () => {
    const onChange = vi.fn();
    render(<DayStepper days={days} value="2026-01-03" onChange={onChange} />);
    fireEvent.click(screen.getByRole("button", { name: "Next day" }));
    expect(onChange).toHaveBeenLastCalledWith("2026-01-04");
    fireEvent.click(screen.getByRole("button", { name: "Previous day" }));
    expect(onChange).toHaveBeenLastCalledWith("2026-01-02");
  });

  it("disables stepping past either end", () => {
    const { rerender } = render(<DayStepper days={days} value="2026-01-02" onChange={vi.fn()} />);
    expect(screen.getByRole("button", { name: "Previous day" })).toBeDisabled();
    rerender(<DayStepper days={days} value="2026-01-04" onChange={vi.fn()} />);
    expect(screen.getByRole("button", { name: "Next day" })).toBeDisabled();
  });

  it("labels days in words and picks from the list", () => {
    const onChange = vi.fn();
    render(<DayStepper days={days} value="2026-01-02" onChange={onChange} />);
    expect(screen.getByRole("option", { name: "Fri 2 Jan 2026" })).toBeInTheDocument();
    fireEvent.change(screen.getByLabelText("Delivery day"), { target: { value: "2026-01-04" } });
    expect(onChange).toHaveBeenLastCalledWith("2026-01-04");
  });
});
```

**`frontend/src/App.test.tsx`** (replace)
```tsx
import { fireEvent, render, screen } from "@testing-library/react";
import App from "./App";
import { api } from "./api";
import { accuracyFixture, decisionFixture, horizonFixture, metaFixture } from "./test/fixtures";

vi.mock("./api", () => ({
  api: { meta: vi.fn(), decision: vi.fn(), accuracy: vi.fn(), byHorizon: vi.fn() },
}));

beforeEach(() => {
  vi.mocked(api.meta).mockResolvedValue(metaFixture);
  vi.mocked(api.decision).mockResolvedValue(decisionFixture);
  vi.mocked(api.accuracy).mockResolvedValue(accuracyFixture);
  vi.mocked(api.byHorizon).mockResolvedValue(horizonFixture);
});

it("switches tabs and swaps the top-bar controls", async () => {
  render(<App />);
  expect(await screen.findByText("Shortfall at risk (P10)")).toBeInTheDocument();
  expect(screen.getByLabelText("Delivery day")).toBeInTheDocument();
  fireEvent.click(screen.getByRole("button", { name: "Forecast accuracy" }));
  expect(await screen.findByText("Mean absolute error")).toBeInTheDocument();
  expect(screen.getByLabelText(/Forecast horizon/)).toBeInTheDocument();
  expect(screen.queryByLabelText("Delivery day")).not.toBeInTheDocument();
});

it("steps to the next delivery day from the top bar", async () => {
  render(<App />);
  await screen.findByText("Shortfall at risk (P10)");
  fireEvent.click(screen.getByRole("button", { name: "Next day" }));
  expect(api.decision).toHaveBeenLastCalledWith("2026-01-03", "09:20");
});

it("changes gate closure from the top bar", async () => {
  render(<App />);
  await screen.findByText("Shortfall at risk (P10)");
  fireEvent.change(screen.getByLabelText("Gate closure on D-1"), { target: { value: "09:50" } });
  expect(api.decision).toHaveBeenLastCalledWith("2026-01-02", "09:50");
});

it("moves the horizon from the top bar", async () => {
  render(<App />);
  await screen.findByText("Shortfall at risk (P10)");
  fireEvent.click(screen.getByRole("button", { name: "Forecast accuracy" }));
  await screen.findByText("Mean absolute error");
  fireEvent.change(screen.getByLabelText(/Forecast horizon/), { target: { value: "6" } });
  expect(api.accuracy).toHaveBeenLastCalledWith(6);
});
```

**`frontend/src/components/DecisionView.test.tsx`** (replace)
```tsx
import { render, screen } from "@testing-library/react";
import { api } from "../api";
import { decisionFixture } from "../test/fixtures";
import { DecisionView } from "./DecisionView";

vi.mock("../api", () => ({
  api: { meta: vi.fn(), decision: vi.fn(), accuracy: vi.fn(), byHorizon: vi.fn() },
}));

beforeEach(() => {
  vi.mocked(api.decision).mockResolvedValue(decisionFixture);
});

describe("DecisionView", () => {
  it("loads the requested day and gate", async () => {
    render(<DecisionView deliveryDate="2026-01-02" gateTime="09:20" />);
    expect(await screen.findByText("Shortfall at risk (P10)")).toBeInTheDocument();
    expect(api.decision).toHaveBeenCalledWith("2026-01-02", "09:20");
    // (1000-800) + (1200-900) = 500 MWh
    expect(screen.getByText("0.5 GWh")).toBeInTheDocument();
  });

  it("refetches when its inputs change", async () => {
    const { rerender } = render(<DecisionView deliveryDate="2026-01-02" gateTime="09:20" />);
    await screen.findByText("Shortfall at risk (P10)");
    rerender(<DecisionView deliveryDate="2026-01-15" gateTime="09:50" />);
    expect(api.decision).toHaveBeenLastCalledWith("2026-01-15", "09:50");
  });
});
```

**`frontend/src/components/AccuracyView.test.tsx`** (replace)
```tsx
import { render, screen } from "@testing-library/react";
import { api } from "../api";
import { accuracyFixture, horizonFixture } from "../test/fixtures";
import { AccuracyView } from "./AccuracyView";

vi.mock("../api", () => ({
  api: { meta: vi.fn(), decision: vi.fn(), accuracy: vi.fn(), byHorizon: vi.fn() },
}));

beforeEach(() => {
  vi.mocked(api.accuracy).mockResolvedValue(accuracyFixture);
  vi.mocked(api.byHorizon).mockResolvedValue(horizonFixture);
});

describe("AccuracyView", () => {
  it("shows headline metrics for the requested horizon", async () => {
    render(<AccuracyView horizon={24} />);
    expect(await screen.findByText("Mean absolute error")).toBeInTheDocument();
    expect(api.accuracy).toHaveBeenCalledWith(24);
    expect(screen.getByText("512 MW")).toBeInTheDocument();
    expect(screen.getByText("6.2%")).toBeInTheDocument();
    expect(await screen.findByText("How error grows with lead time")).toBeInTheDocument();
  });

  it("refetches when the horizon changes", async () => {
    const { rerender } = render(<AccuracyView horizon={24} />);
    await screen.findByText("Mean absolute error");
    rerender(<AccuracyView horizon={6} />);
    expect(api.accuracy).toHaveBeenLastCalledWith(6);
  });
});
```

- [ ] **Step 2: Run tests to verify they fail**

Run: `npm test`
Expected: FAIL. `DayStepper` can't be resolved, and the App and view tests don't find the new controls or props.

- [ ] **Step 3: Write the shell, controls and updated views**

**`frontend/src/components/icons.tsx`** (create)
```tsx
interface IconProps {
  className?: string;
}

const base = {
  width: 18,
  height: 18,
  viewBox: "0 0 24 24",
  fill: "none",
  stroke: "currentColor",
  strokeWidth: 2,
  strokeLinecap: "round" as const,
  strokeLinejoin: "round" as const,
  "aria-hidden": true,
};

export function WindMark({ className }: IconProps) {
  return (
    <svg {...base} width={22} height={22} className={className}>
      <path d="M5 8h8.5a2.5 2.5 0 1 0 -2.34 -3.24" />
      <path d="M3 12h15.5a2.5 2.5 0 1 1 -2.34 3.24" />
      <path d="M4 16h5.5a2.5 2.5 0 1 1 -2.34 3.24" />
    </svg>
  );
}

export function ChevronDown({ className }: IconProps) {
  return (
    <svg {...base} width={16} height={16} className={className}>
      <path d="M6 9l6 6l6 -6" />
    </svg>
  );
}

export function ChevronLeft({ className }: IconProps) {
  return (
    <svg {...base} className={className}>
      <path d="M15 6l-6 6l6 6" />
    </svg>
  );
}

export function ChevronRight({ className }: IconProps) {
  return (
    <svg {...base} className={className}>
      <path d="M9 6l6 6l-6 6" />
    </svg>
  );
}
```

**`frontend/src/components/layout/TopBar.tsx`** (create)
```tsx
import type { ReactNode } from "react";
import { WindMark } from "../icons";
import s from "./TopBar.module.css";

export type Tab = "decision" | "accuracy";

const TABS: { id: Tab; label: string }[] = [
  { id: "decision", label: "Day-ahead decision" },
  { id: "accuracy", label: "Forecast accuracy" },
];

interface TopBarProps {
  tab: Tab;
  onTabChange: (tab: Tab) => void;
  controls?: ReactNode;
}

export function TopBar({ tab, onTabChange, controls }: TopBarProps) {
  return (
    <header className={s.bar}>
      <div className={s.inner}>
        <div className={s.brand}>
          <WindMark className={s.mark} />
          <span>GridBrick</span>
        </div>
        <nav className={s.tabs} aria-label="Views">
          {TABS.map((t) => (
            <button
              key={t.id}
              type="button"
              className={s.tab}
              aria-current={tab === t.id ? "page" : undefined}
              onClick={() => onTabChange(t.id)}
            >
              {t.label}
            </button>
          ))}
        </nav>
        {controls && <div className={s.controls}>{controls}</div>}
      </div>
    </header>
  );
}
```

**`frontend/src/components/layout/TopBar.module.css`** (create)
```css
.bar {
  position: sticky;
  top: 0;
  z-index: 10;
  background: var(--bg);
  border-bottom: 1px solid var(--border);
}
.inner {
  max-width: var(--content-width);
  margin: 0 auto;
  padding: 0 var(--space-6);
  min-height: 60px;
  display: flex;
  align-items: stretch;
  gap: var(--space-7);
  flex-wrap: wrap;
}
.brand {
  display: flex;
  align-items: center;
  gap: var(--space-2);
  font-size: var(--text-lg);
  font-weight: 500;
}
.mark {
  color: var(--forecast);
}
.tabs {
  display: flex;
  gap: var(--space-6);
}
.tab {
  display: flex;
  align-items: center;
  padding: 0;
  border: 0;
  border-bottom: 2px solid transparent;
  margin-bottom: -1px;
  background: none;
  color: var(--text-2);
  font-size: var(--text-md);
  cursor: pointer;
}
.tab:hover {
  color: var(--text);
}
.tab[aria-current="page"] {
  color: var(--text);
  font-weight: 500;
  border-bottom-color: var(--forecast);
}
.controls {
  margin-left: auto;
  display: flex;
  align-items: center;
  gap: var(--space-3);
  padding: var(--space-3) 0;
  flex-wrap: wrap;
}
@media (max-width: 900px) {
  .controls {
    margin-left: 0;
    width: 100%;
  }
}
```

**`frontend/src/components/controls/Select.tsx`** (create)
```tsx
import { useId } from "react";
import { ChevronDown } from "../icons";
import s from "./Select.module.css";

export interface SelectOption {
  value: string;
  label: string;
}

interface SelectProps {
  label: string;
  value: string;
  options: SelectOption[];
  onChange: (value: string) => void;
  hideLabel?: boolean;
}

export function Select({ label, value, options, onChange, hideLabel }: SelectProps) {
  const id = useId();
  return (
    <div className={s.field}>
      <label htmlFor={id} className={hideLabel ? "visually-hidden" : s.label}>
        {label}
      </label>
      <div className={s.wrap}>
        <select id={id} className={s.select} value={value} onChange={(e) => onChange(e.target.value)}>
          {options.map((o) => (
            <option key={o.value} value={o.value}>
              {o.label}
            </option>
          ))}
        </select>
        <ChevronDown className={s.chevron} />
      </div>
    </div>
  );
}
```

**`frontend/src/components/controls/Select.module.css`** (create)
```css
.field {
  display: flex;
  align-items: center;
  gap: var(--space-2);
}
.label {
  font-size: var(--text-sm);
  color: var(--text-2);
}
.wrap {
  position: relative;
  display: inline-flex;
}
.select {
  appearance: none;
  height: 34px;
  padding: 0 var(--space-7) 0 var(--space-3);
  border: 1px solid var(--border-strong);
  border-radius: var(--radius-control);
  background: var(--bg);
  font-size: var(--text-sm);
  cursor: pointer;
}
.select:hover {
  border-color: var(--text-3);
}
.chevron {
  position: absolute;
  right: var(--space-2);
  top: 50%;
  transform: translateY(-50%);
  color: var(--text-3);
  pointer-events: none;
}
```

**`frontend/src/components/controls/DayStepper.tsx`** (create)
```tsx
import { formatDayLong } from "../../format";
import { ChevronLeft, ChevronRight } from "../icons";
import s from "./DayStepper.module.css";
import { Select } from "./Select";

interface DayStepperProps {
  days: string[];
  value: string;
  onChange: (day: string) => void;
}

export function DayStepper({ days, value, onChange }: DayStepperProps) {
  const index = days.indexOf(value);
  return (
    <div className={s.stepper}>
      <button
        type="button"
        className={s.step}
        aria-label="Previous day"
        disabled={index <= 0}
        onClick={() => onChange(days[index - 1])}
      >
        <ChevronLeft />
      </button>
      <Select
        label="Delivery day"
        hideLabel
        value={value}
        options={days.map((d) => ({ value: d, label: formatDayLong(d) }))}
        onChange={onChange}
      />
      <button
        type="button"
        className={s.step}
        aria-label="Next day"
        disabled={index >= days.length - 1}
        onClick={() => onChange(days[index + 1])}
      >
        <ChevronRight />
      </button>
    </div>
  );
}
```

**`frontend/src/components/controls/DayStepper.module.css`** (create)
```css
.stepper {
  display: flex;
  align-items: center;
  gap: var(--space-1);
}
.step {
  width: 34px;
  height: 34px;
  display: inline-flex;
  align-items: center;
  justify-content: center;
  border: 1px solid var(--border-strong);
  border-radius: var(--radius-control);
  background: var(--bg);
  color: var(--text-2);
  cursor: pointer;
}
.step:hover:not(:disabled) {
  color: var(--text);
  border-color: var(--text-3);
}
.step:disabled {
  opacity: 0.4;
  cursor: default;
}
```

**`frontend/src/components/controls/HorizonSlider.tsx`** (create)
```tsx
import { useId } from "react";
import s from "./HorizonSlider.module.css";

interface HorizonSliderProps {
  value: number;
  max: number;
  onChange: (hours: number) => void;
}

export function HorizonSlider({ value, max, onChange }: HorizonSliderProps) {
  const id = useId();
  return (
    <div className={s.field}>
      <label htmlFor={id} className={s.label}>
        Forecast horizon
      </label>
      <input
        id={id}
        className={s.range}
        type="range"
        min={0}
        max={max}
        step={1}
        value={value}
        onChange={(e) => onChange(Number(e.target.value))}
      />
      <output htmlFor={id} className={s.value}>
        {value} h ahead
      </output>
    </div>
  );
}
```

**`frontend/src/components/controls/HorizonSlider.module.css`** (create)
```css
.field {
  display: flex;
  align-items: center;
  gap: var(--space-3);
}
.label {
  font-size: var(--text-sm);
  color: var(--text-2);
}
.range {
  width: 220px;
  accent-color: var(--forecast);
}
.value {
  min-width: 84px;
  font-size: var(--text-sm);
  font-weight: 500;
}
```

**`frontend/src/components/controls/gateOptions.ts`** (create)
```ts
import type { SelectOption } from "./Select";

// GB day-ahead auctions since 2021; UK time equals UTC in January.
export const GATE_OPTIONS: SelectOption[] = [
  { value: "09:20", label: "Gate 09:20 · EPEX 60-min" },
  { value: "09:50", label: "Gate 09:50 · N2EX hourly" },
  { value: "15:30", label: "Gate 15:30 · EPEX 30-min" },
];
```

**`frontend/src/App.module.css`** (create)
```css
.main {
  max-width: var(--content-width);
  margin: 0 auto;
  padding: var(--space-6) var(--space-6) var(--space-7);
}
.footer {
  max-width: var(--content-width);
  margin: 0 auto;
  padding: 0 var(--space-6) var(--space-7);
  font-size: var(--text-xs);
  color: var(--text-3);
}
.boot {
  max-width: var(--content-width);
  margin: 0 auto;
  padding: var(--space-8) var(--space-6);
  color: var(--text-2);
}
```

**`frontend/src/App.tsx`** (replace)
```tsx
import { useMemo, useState } from "react";
import { api } from "./api";
import s from "./App.module.css";
import { AccuracyView } from "./components/AccuracyView";
import { DayStepper } from "./components/controls/DayStepper";
import { GATE_OPTIONS } from "./components/controls/gateOptions";
import { HorizonSlider } from "./components/controls/HorizonSlider";
import { Select } from "./components/controls/Select";
import { DecisionView } from "./components/DecisionView";
import { type Tab, TopBar } from "./components/layout/TopBar";
import { deliveryDates } from "./format";
import type { Meta } from "./types";
import { useAsync } from "./useAsync";

const DEFAULT_HORIZON_HOURS = 24;

function Dashboard({ meta }: { meta: Meta }) {
  const [tab, setTab] = useState<Tab>("decision");
  const days = useMemo(() => deliveryDates(meta.first_delivery_date, meta.last_delivery_date), [meta]);
  const [deliveryDate, setDeliveryDate] = useState(meta.first_delivery_date);
  const [gateTime, setGateTime] = useState(meta.default_gate_time_utc);
  const [horizon, setHorizon] = useState(DEFAULT_HORIZON_HOURS);

  const controls =
    tab === "decision" ? (
      <>
        <DayStepper days={days} value={deliveryDate} onChange={setDeliveryDate} />
        <Select label="Gate closure on D-1" hideLabel value={gateTime} options={GATE_OPTIONS} onChange={setGateTime} />
      </>
    ) : (
      <HorizonSlider value={horizon} max={meta.max_horizon_hours} onChange={setHorizon} />
    );

  return (
    <>
      <TopBar tab={tab} onTabChange={setTab} controls={controls} />
      <main className={s.main}>
        {tab === "decision" ? (
          <DecisionView deliveryDate={deliveryDate} gateTime={gateTime} />
        ) : (
          <AccuracyView horizon={horizon} />
        )}
      </main>
      <footer className={s.footer}>
        Data: Elexon BMRS — FUELHH outturn (fuel type WIND) and WINDFOR forecasts, {meta.forecast_runs} forecast runs.
        All times UTC, which equals UK time in January.
      </footer>
    </>
  );
}

export default function App() {
  const meta = useAsync(() => api.meta(), []);
  if (meta.data) return <Dashboard meta={meta.data} />;
  return <div className={s.boot}>{meta.error ?? "Loading…"}</div>;
}
```

**`frontend/src/components/DecisionView.tsx`** (replace; controls removed, otherwise unchanged until Tasks 3–4)
```tsx
import { Area, CartesianGrid, ComposedChart, Legend, Line, ResponsiveContainer, Tooltip, XAxis, YAxis } from "recharts";
import { api } from "../api";
import { formatGwh, formatHourUtc, formatMw, formatUtc } from "../format";
import type { DecisionResponse } from "../types";
import { useAsync } from "../useAsync";
import { type Card, MetricCards } from "./MetricCards";

function shortfallAtRiskMwh(d: DecisionResponse): number | null {
  // Energy to cover if wind lands at the low (P10) bound; points are hourly so summed MW are MWh.
  if (d.points.length === 0 || d.points.some((p) => p.low_mw == null)) return null;
  return d.points.reduce((sum, p) => sum + (p.forecast_mw - (p.low_mw as number)), 0);
}

function decisionCards(d: DecisionResponse): Card[] {
  const atRisk = shortfallAtRiskMwh(d);
  return [
    { label: "Forecast wind energy", value: formatGwh(d.forecast_energy_mwh), hint: `delivery day ${d.delivery_date}` },
    { label: "Latest forecast before gate", value: formatUtc(d.forecast_published_at), hint: `gate closure ${formatUtc(d.gate_closure)}` },
    {
      label: "Shortfall at risk (P10)",
      value: formatGwh(atRisk),
      hint: atRisk == null ? "not enough history for a range yet" : `from ${d.band_samples} recent forecast/actual pairs`,
    },
    {
      label: "Actual wind energy",
      value: formatGwh(d.actual_energy_mwh),
      hint: d.metrics.n > 0 ? `hourly MAE ${formatMw(d.metrics.mae_mw)}` : "outturn not yet available",
    },
  ];
}

const mwOrRange = (v: unknown): string =>
  Array.isArray(v) ? `${formatMw(v[0] as number)} – ${formatMw(v[1] as number)}` : formatMw(v as number);

interface DecisionViewProps {
  deliveryDate: string;
  gateTime: string;
}

export function DecisionView({ deliveryDate, gateTime }: DecisionViewProps) {
  const decision = useAsync(() => api.decision(deliveryDate, gateTime), [deliveryDate, gateTime]);
  const d = decision.data;

  const rows = d?.points.map((p) => ({
    time: formatHourUtc(p.start_time),
    forecast: p.forecast_mw,
    actual: p.actual_mw,
    band: p.low_mw != null && p.high_mw != null ? [p.low_mw, p.high_mw] : null,
  }));

  return (
    <section>
      {decision.error && <div className="error">{decision.error}</div>}
      {d && (
        <>
          <MetricCards cards={decisionCards(d)} />
          <div className="panel">
            <h2>Wind forecast available at gate closure vs outturn</h2>
            <p>
              Shaded band: likely range (P10–P90) based on errors from the last 14 days at each hour's own lead time,
              using only outturn published before gate closure.
            </p>
            <ResponsiveContainer width="100%" height={360}>
              <ComposedChart data={rows}>
                <CartesianGrid strokeDasharray="3 3" stroke="#e6e5e1" />
                <XAxis dataKey="time" />
                <YAxis tickFormatter={(v: number) => `${(v / 1000).toFixed(0)} GW`} />
                <Tooltip formatter={mwOrRange} />
                <Legend />
                <Area dataKey="band" name="Likely range (P10–P90)" fill="#93c5fd" stroke="none" fillOpacity={0.4} />
                <Line dataKey="forecast" name="Forecast" stroke="#1f5fbf" strokeWidth={2} dot={false} />
                <Line dataKey="actual" name="Actual" stroke="#3d3d3a" strokeWidth={2} dot={false} />
              </ComposedChart>
            </ResponsiveContainer>
          </div>
        </>
      )}
    </section>
  );
}
```

**`frontend/src/components/AccuracyView.tsx`** (replace; slider removed, otherwise unchanged until Task 5)
```tsx
import {
  Area,
  Bar,
  BarChart,
  CartesianGrid,
  ComposedChart,
  Legend,
  Line,
  LineChart,
  ResponsiveContainer,
  Tooltip,
  XAxis,
  YAxis,
} from "recharts";
import { api } from "../api";
import { formatDayHourUtc, formatMw, formatPct } from "../format";
import { useAsync } from "../useAsync";
import { MetricCards } from "./MetricCards";

const gw = (v: number) => `${(v / 1000).toFixed(0)} GW`;
const mwOrRange = (v: unknown): string =>
  Array.isArray(v) ? `${formatMw(v[0] as number)} – ${formatMw(v[1] as number)}` : formatMw(v as number);

export function AccuracyView({ horizon }: { horizon: number }) {
  const accuracy = useAsync(() => api.accuracy(horizon), [horizon]);
  const profile = useAsync(() => api.byHorizon(), []);
  const a = accuracy.data;
  const m = a?.metrics;

  const series = a?.points.map((p) => ({ time: formatDayHourUtc(p.start_time), forecast: p.forecast_mw, actual: p.actual_mw }));
  const bins = a?.histogram.map((b) => ({ label: `${(b.bin_start_mw / 1000).toFixed(2)} GW`, count: b.count }));
  const byHorizon = profile.data?.map((r) => ({
    horizon: r.horizon_hours,
    mae: r.metrics.mae_mw,
    band: r.p10_error_mw != null && r.p90_error_mw != null ? [r.p10_error_mw, r.p90_error_mw] : null,
  }));

  return (
    <section>
      {accuracy.error && <div className="error">{accuracy.error}</div>}
      {m && (
        <MetricCards
          cards={[
            { label: "Mean absolute error", value: formatMw(m.mae_mw), hint: `${m.n} hourly samples` },
            { label: "RMSE", value: formatMw(m.rmse_mw), hint: "penalises large misses" },
            { label: "Bias", value: formatMw(m.bias_mw), hint: "positive = wind over-forecast" },
            { label: "WAPE", value: formatPct(m.wape_pct), hint: "absolute error as % of actual energy" },
            { label: "P90 absolute error", value: formatMw(m.p90_abs_mw), hint: "9 in 10 hours miss by less" },
          ]}
        />
      )}
      {a && (
        <div className="panel">
          <h2>Actual vs forecast — January 2026 delivery</h2>
          <p>Forecast shown is what was available {horizon} h before each hour.</p>
          <ResponsiveContainer width="100%" height={320}>
            <LineChart data={series}>
              <CartesianGrid strokeDasharray="3 3" stroke="#e6e5e1" />
              <XAxis dataKey="time" minTickGap={60} />
              <YAxis tickFormatter={gw} />
              <Tooltip formatter={mwOrRange} />
              <Legend />
              <Line dataKey="actual" name="Actual" stroke="#3d3d3a" dot={false} strokeWidth={1.5} />
              <Line dataKey="forecast" name="Forecast" stroke="#1f5fbf" dot={false} strokeWidth={1.5} />
            </LineChart>
          </ResponsiveContainer>
        </div>
      )}
      <div className="grid-2">
        {a && (
          <div className="panel">
            <h2>Error distribution</h2>
            <p>Forecast − actual, hourly. Right of zero means wind came in lower than forecast.</p>
            <ResponsiveContainer width="100%" height={260}>
              <BarChart data={bins}>
                <CartesianGrid strokeDasharray="3 3" stroke="#e6e5e1" />
                <XAxis dataKey="label" minTickGap={20} />
                <YAxis allowDecimals={false} />
                <Tooltip />
                <Bar dataKey="count" name="Hours" fill="#b4b2a9" />
              </BarChart>
            </ResponsiveContainer>
          </div>
        )}
        {byHorizon && (
          <div className="panel">
            <h2>How error grows with lead time</h2>
            <p>MAE and P10–P90 signed error by forecast horizon (hours before delivery).</p>
            <ResponsiveContainer width="100%" height={260}>
              <ComposedChart data={byHorizon}>
                <CartesianGrid strokeDasharray="3 3" stroke="#e6e5e1" />
                <XAxis dataKey="horizon" unit=" h" />
                <YAxis tickFormatter={gw} />
                <Tooltip formatter={mwOrRange} />
                <Legend />
                <Area dataKey="band" name="P10–P90 error" fill="rgba(31, 95, 191, 0.12)" stroke="none" />
                <Line dataKey="mae" name="MAE" stroke="#1f5fbf" strokeWidth={2} />
              </ComposedChart>
            </ResponsiveContainer>
          </div>
        )}
      </div>
    </section>
  );
}
```

- [ ] **Step 4: Run tests and build**

Run: `npm test && npm run build`
Expected: all tests pass (including 3 new `DayStepper` tests and 4 `App` tests), and the build succeeds.

- [ ] **Step 5: Commit, push, deploy, check**

```bash
git add src
git commit -m "feat(ui): add top bar with page controls and lift page state into App"
git push origin main
cd .. && npx vercel deploy --prod --yes && cd frontend
```
Check the live site:
- The sticky top bar shows the wordmark, underlined tabs, and the day stepper plus gate select on the right.
- On the accuracy tab, the right of the bar shows the horizon slider instead.

---

### Task 3: Chart kit and the day-ahead chart

**Files:**
- Create: `frontend/src/components/charts/chartTheme.ts`, `frontend/src/components/charts/ticks.ts`, `frontend/src/components/charts/decisionSeries.ts`, `frontend/src/components/charts/ChartTooltip.tsx`, `frontend/src/components/charts/ChartTooltip.module.css`, `frontend/src/components/charts/ChartLegend.tsx`, `frontend/src/components/charts/ChartLegend.module.css`, `frontend/src/components/charts/DecisionChart.tsx`, `frontend/src/components/layout/Panel.tsx`, `frontend/src/components/layout/Panel.module.css`
- Replace: `frontend/src/components/DecisionView.tsx`
- Tests (create): `frontend/src/components/charts/ticks.test.ts`, `frontend/src/components/charts/decisionSeries.test.ts`, `frontend/src/components/charts/ChartTooltip.test.tsx`

**Interfaces:**
- Consumes: `formatGw`, `formatGwRange`, `formatGwTick`, `formatHourUtc`, `formatDayHour` (Task 1); `DecisionPoint` (`types.ts`).
- Produces:
  - `chartColors`, `gridProps`, `axisProps`
  - `niceTicks(min: number, max: number, targetCount?: number): number[]`
  - `weeklyTicks(times: string[]): string[]`
  - `DecisionRow = { time: string; startTime: string; forecast: number; actual: number | null; range: [number, number] | null; below: number | null }`
  - `belowRangeHours(points: DecisionPoint[]): string[]`
  - `toDecisionRows(points: DecisionPoint[]): DecisionRow[]`
  - `TooltipLine = { label: string; value: string; color: string; kind?: "line" | "dashed" | "area" }`
  - `ChartTooltip<T>({ active?, payload?, title: (row: T) => string, lines: (row: T) => TooltipLine[] })`
  - `LegendItem = { label: string; color: string; kind: "line" | "dashed" | "area" | "dot" | "bar" }`
  - `ChartLegend({ items: LegendItem[] })`
  - `Panel({ title: string; subtitle?: string; legend?: ReactNode; children: ReactNode; className?: string })`
  - `DecisionChart({ points: DecisionPoint[] })`
  - `DECISION_LEGEND: LegendItem[]` (exported from `DecisionChart.tsx`)

- [ ] **Step 1: Write the failing tests**

**`frontend/src/components/charts/ticks.test.ts`** (create)
```ts
import { niceTicks, weeklyTicks } from "./ticks";

describe("niceTicks", () => {
  it("rounds up to clean GW steps from zero", () => {
    expect(niceTicks(0, 21000)).toEqual([0, 5000, 10000, 15000, 20000, 25000]);
    expect(niceTicks(0, 18000)).toEqual([0, 5000, 10000, 15000, 20000]);
  });
  it("handles small ranges and a custom target count", () => {
    expect(niceTicks(0, 900)).toEqual([0, 200, 400, 600, 800, 1000]);
    expect(niceTicks(0, 1200, 4)).toEqual([0, 500, 1000, 1500]);
  });
  it("spans negative minimums", () => {
    expect(niceTicks(-850, 4500)).toEqual([-2000, 0, 2000, 4000, 6000]);
  });
  it("returns just zero for an empty range", () => {
    expect(niceTicks(0, 0)).toEqual([0]);
  });
});

describe("weeklyTicks", () => {
  it("keeps Monday midnights only", () => {
    expect(
      weeklyTicks(["2026-01-05T00:00:00Z", "2026-01-05T01:00:00Z", "2026-01-06T00:00:00Z", "2026-01-12T00:00:00Z"]),
    ).toEqual(["2026-01-05T00:00:00Z", "2026-01-12T00:00:00Z"]);
  });
});
```

**`frontend/src/components/charts/decisionSeries.test.ts`** (create)
```ts
import type { DecisionPoint } from "../../types";
import { belowRangeHours, toDecisionRows } from "./decisionSeries";

const points: DecisionPoint[] = [
  { start_time: "2026-01-15T00:00:00Z", forecast_mw: 1000, actual_mw: 700, low_mw: 800, high_mw: 1100 },
  { start_time: "2026-01-15T01:00:00Z", forecast_mw: 1000, actual_mw: 900, low_mw: 800, high_mw: 1100 },
  { start_time: "2026-01-15T02:00:00Z", forecast_mw: 1000, actual_mw: null, low_mw: 800, high_mw: 1100 },
  { start_time: "2026-01-15T03:00:00Z", forecast_mw: 1000, actual_mw: 500, low_mw: null, high_mw: null },
];

describe("decisionSeries", () => {
  it("finds hours where outturn fell below the likely range", () => {
    expect(belowRangeHours(points)).toEqual(["2026-01-15T00:00:00Z"]);
  });

  it("builds chart rows with range and below-range markers", () => {
    const rows = toDecisionRows(points);
    expect(rows[0]).toEqual({
      time: "00:00",
      startTime: "2026-01-15T00:00:00Z",
      forecast: 1000,
      actual: 700,
      range: [800, 1100],
      below: 700,
    });
    expect(rows[1].below).toBeNull();
    expect(rows[3].range).toBeNull();
  });
});
```

**`frontend/src/components/charts/ChartTooltip.test.tsx`** (create)
```tsx
import { render, screen } from "@testing-library/react";
import { ChartTooltip } from "./ChartTooltip";

type Row = { startTime: string };
const row: Row = { startTime: "2026-01-15T14:00:00Z" };

describe("ChartTooltip", () => {
  it("renders a title and one line per series", () => {
    render(
      <ChartTooltip<Row>
        active
        payload={[{ payload: row }]}
        title={() => "Thu 15 Jan, 14:00"}
        lines={() => [
          { label: "Forecast", value: "15.8 GW", color: "#1f5fbf" },
          { label: "Outturn", value: "14.6 GW", color: "#3d3d3a", kind: "dashed" },
        ]}
      />,
    );
    expect(screen.getByText("Thu 15 Jan, 14:00")).toBeInTheDocument();
    expect(screen.getByText("15.8 GW")).toBeInTheDocument();
    expect(screen.getByText("Outturn")).toBeInTheDocument();
  });

  it("renders nothing when inactive", () => {
    const { container } = render(
      <ChartTooltip<Row> active={false} payload={[{ payload: row }]} title={() => "x"} lines={() => []} />,
    );
    expect(container).toBeEmptyDOMElement();
  });
});
```

- [ ] **Step 2: Run tests to verify they fail**

Run: `npx vitest run src/components/charts`
Expected: FAIL. `./ticks`, `./decisionSeries` and `./ChartTooltip` can't be resolved.

- [ ] **Step 3: Write the chart kit, panel and day-ahead chart**

**`frontend/src/components/charts/chartTheme.ts`** (create)
```ts
// Mirrors styles/tokens.css: Recharts needs literal colour values, not CSS variables.
export const chartColors = {
  forecast: "#1f5fbf",
  forecastRange: "rgba(31, 95, 191, 0.12)",
  forecastRangeKey: "rgba(31, 95, 191, 0.28)",
  outturn: "#3d3d3a",
  risk: "#b45309",
  neutralBar: "#b4b2a9",
  grid: "#e6e5e1",
  axis: "#8a8984",
} as const;

export const gridProps = { stroke: chartColors.grid, vertical: false } as const;

export const axisProps = {
  axisLine: false,
  tickLine: false,
  tick: { fill: chartColors.axis, fontSize: 12 },
} as const;
```

**`frontend/src/components/charts/ticks.ts`** (create)
```ts
const STEP_MULTIPLIERS = [1, 2, 2.5, 5, 10];

/** Round axis ticks covering [min, max] and always including 0, e.g. 0, 5000, 10000 … */
export function niceTicks(min: number, max: number, targetCount = 5): number[] {
  const lo = Math.min(0, min);
  const hi = Math.max(0, max);
  if (hi - lo <= 0) return [0];
  const raw = (hi - lo) / targetCount;
  const magnitude = 10 ** Math.floor(Math.log10(raw));
  const step = STEP_MULTIPLIERS.map((m) => m * magnitude).find((s) => s >= raw) as number;
  const start = Math.floor(lo / step) * step;
  const end = Math.ceil(hi / step) * step;
  const ticks: number[] = [];
  for (let i = 0; start + i * step <= end + step * 1e-9; i++) {
    ticks.push(Math.round((start + i * step) * 1e6) / 1e6);
  }
  return ticks;
}

/** Monday 00:00 UTC timestamps from a list of ISO times, for weekly date ticks. */
export function weeklyTicks(times: string[]): string[] {
  return times.filter((t) => {
    const d = new Date(t);
    return d.getUTCDay() === 1 && d.getUTCHours() === 0 && d.getUTCMinutes() === 0;
  });
}
```

**`frontend/src/components/charts/decisionSeries.ts`** (create)
```ts
import { formatHourUtc } from "../../format";
import type { DecisionPoint } from "../../types";

export interface DecisionRow {
  time: string;
  startTime: string;
  forecast: number;
  actual: number | null;
  range: [number, number] | null;
  below: number | null;
}

const isBelowRange = (p: DecisionPoint): boolean => p.actual_mw != null && p.low_mw != null && p.actual_mw < p.low_mw;

export const belowRangeHours = (points: DecisionPoint[]): string[] =>
  points.filter(isBelowRange).map((p) => p.start_time);

export const toDecisionRows = (points: DecisionPoint[]): DecisionRow[] =>
  points.map((p) => ({
    time: formatHourUtc(p.start_time),
    startTime: p.start_time,
    forecast: p.forecast_mw,
    actual: p.actual_mw,
    range: p.low_mw != null && p.high_mw != null ? [p.low_mw, p.high_mw] : null,
    below: isBelowRange(p) ? p.actual_mw : null,
  }));
```

**`frontend/src/components/charts/ChartTooltip.tsx`** (create)
```tsx
import s from "./ChartTooltip.module.css";

export interface TooltipLine {
  label: string;
  value: string;
  color: string;
  kind?: "line" | "dashed" | "area";
}

interface ChartTooltipProps<T> {
  active?: boolean;
  payload?: ReadonlyArray<{ payload?: T }>;
  title: (row: T) => string;
  lines: (row: T) => TooltipLine[];
}

export function ChartTooltip<T>({ active, payload, title, lines }: ChartTooltipProps<T>) {
  const row = payload?.[0]?.payload;
  if (!active || !row) return null;
  return (
    <div className={s.tooltip}>
      <div className={s.title}>{title(row)}</div>
      {lines(row).map((l) => (
        <div key={l.label} className={s.line}>
          <span className={s.swatch} data-kind={l.kind ?? "line"} style={{ color: l.color }} />
          <span className={s.label}>{l.label}</span>
          <span className={s.value}>{l.value}</span>
        </div>
      ))}
    </div>
  );
}
```

**`frontend/src/components/charts/ChartTooltip.module.css`** (create)
```css
.tooltip {
  min-width: 190px;
  padding: var(--space-2) var(--space-3);
  background: var(--bg);
  border: 1px solid var(--border);
  border-radius: 8px;
  box-shadow: var(--shadow-tooltip);
  font-size: var(--text-xs);
}
.title {
  margin-bottom: var(--space-1);
  color: var(--text-2);
}
.line {
  display: grid;
  grid-template-columns: 14px 1fr auto;
  align-items: center;
  gap: var(--space-2);
  padding: 2px 0;
}
.swatch {
  width: 14px;
  border-top: 2px solid currentColor;
}
.swatch[data-kind="dashed"] {
  border-top-style: dashed;
}
.swatch[data-kind="area"] {
  height: 8px;
  border: 0;
  border-radius: 2px;
  background: currentColor;
  opacity: 0.35;
}
.label {
  color: var(--text-2);
}
.value {
  font-weight: 500;
  text-align: right;
}
```

**`frontend/src/components/charts/ChartLegend.tsx`** (create)
```tsx
import type { CSSProperties } from "react";
import s from "./ChartLegend.module.css";

export interface LegendItem {
  label: string;
  color: string;
  kind: "line" | "dashed" | "area" | "dot" | "bar";
}

export function ChartLegend({ items }: { items: LegendItem[] }) {
  return (
    <ul className={s.legend}>
      {items.map((item) => (
        <li key={item.label}>
          <span className={s.key} data-kind={item.kind} style={{ "--key": item.color } as CSSProperties} />
          {item.label}
        </li>
      ))}
    </ul>
  );
}
```

**`frontend/src/components/charts/ChartLegend.module.css`** (create)
```css
.legend {
  display: flex;
  flex-wrap: wrap;
  gap: var(--space-2) var(--space-4);
  margin: 0;
  padding: 0;
  list-style: none;
  font-size: var(--text-xs);
  color: var(--text-2);
}
.legend li {
  display: flex;
  align-items: center;
  gap: var(--space-2);
}
.key {
  display: inline-block;
  width: 16px;
}
.key[data-kind="line"] {
  height: 2px;
  background: var(--key);
}
.key[data-kind="dashed"] {
  border-top: 2px dashed var(--key);
}
.key[data-kind="area"] {
  height: 10px;
  border-radius: 2px;
  background: var(--key);
}
.key[data-kind="dot"] {
  width: 8px;
  height: 8px;
  border-radius: 50%;
  background: var(--key);
}
.key[data-kind="bar"] {
  width: 10px;
  height: 10px;
  border-radius: 2px;
  background: var(--key);
}
```

**`frontend/src/components/layout/Panel.tsx`** (create)
```tsx
import type { ReactNode } from "react";
import { cx } from "../../cx";
import s from "./Panel.module.css";

interface PanelProps {
  title: string;
  subtitle?: string;
  legend?: ReactNode;
  children: ReactNode;
  className?: string;
}

export function Panel({ title, subtitle, legend, children, className }: PanelProps) {
  return (
    <section className={cx(s.panel, className)}>
      <header className={s.head}>
        <div>
          <h2 className={s.title}>{title}</h2>
          {subtitle && <p className={s.subtitle}>{subtitle}</p>}
        </div>
        {legend}
      </header>
      <div className={s.body}>{children}</div>
    </section>
  );
}
```

**`frontend/src/components/layout/Panel.module.css`** (create)
```css
.panel {
  min-width: 0;
  background: var(--bg);
  border: 1px solid var(--border);
  border-radius: var(--radius-panel);
}
.head {
  display: flex;
  justify-content: space-between;
  align-items: flex-start;
  gap: var(--space-4);
  flex-wrap: wrap;
  padding: var(--space-4) var(--space-5) 0;
}
.title {
  font-size: var(--text-lg);
}
.subtitle {
  margin-top: 2px;
  font-size: var(--text-sm);
  color: var(--text-2);
}
.body {
  padding: var(--space-3) var(--space-4) var(--space-4);
}
```

**`frontend/src/components/charts/DecisionChart.tsx`** (create)
```tsx
import { Area, CartesianGrid, ComposedChart, Line, ResponsiveContainer, Scatter, Tooltip, XAxis, YAxis } from "recharts";
import { formatDayHour, formatGw, formatGwRange, formatGwTick } from "../../format";
import type { DecisionPoint } from "../../types";
import type { LegendItem } from "./ChartLegend";
import { ChartTooltip, type TooltipLine } from "./ChartTooltip";
import { axisProps, chartColors, gridProps } from "./chartTheme";
import { type DecisionRow, toDecisionRows } from "./decisionSeries";
import { niceTicks } from "./ticks";

export const DECISION_LEGEND: LegendItem[] = [
  { label: "Forecast", color: chartColors.forecast, kind: "line" },
  { label: "Likely range (P10–P90)", color: chartColors.forecastRangeKey, kind: "area" },
  { label: "Outturn", color: chartColors.outturn, kind: "dashed" },
  { label: "Below range", color: chartColors.risk, kind: "dot" },
];

function tooltipLines(r: DecisionRow): TooltipLine[] {
  const lines: TooltipLine[] = [{ label: "Forecast", value: formatGw(r.forecast), color: chartColors.forecast }];
  if (r.range) {
    lines.push({ label: "Likely range", value: formatGwRange(r.range[0], r.range[1]), color: chartColors.forecast, kind: "area" });
  }
  lines.push({
    label: "Outturn",
    value: r.actual == null ? "Not yet available" : formatGw(r.actual),
    color: chartColors.outturn,
    kind: "dashed",
  });
  return lines;
}

export function DecisionChart({ points }: { points: DecisionPoint[] }) {
  const rows = toDecisionRows(points);
  const max = Math.max(0, ...points.flatMap((p) => [p.forecast_mw, p.actual_mw ?? 0, p.high_mw ?? 0]));
  const yTicks = niceTicks(0, max);
  const xTicks = rows.filter((_, i) => i % 3 === 0).map((r) => r.time);

  return (
    <ResponsiveContainer width="100%" height={340}>
      <ComposedChart data={rows} margin={{ top: 8, right: 8, bottom: 0, left: 0 }}>
        <CartesianGrid {...gridProps} />
        <XAxis dataKey="time" ticks={xTicks} interval={0} {...axisProps} />
        <YAxis ticks={yTicks} domain={[yTicks[0], yTicks[yTicks.length - 1]]} tickFormatter={formatGwTick} width={52} {...axisProps} />
        <Tooltip
          cursor={{ stroke: chartColors.grid }}
          content={<ChartTooltip<DecisionRow> title={(r) => formatDayHour(r.startTime)} lines={tooltipLines} />}
        />
        <Area dataKey="range" fill={chartColors.forecastRange} stroke="none" activeDot={false} isAnimationActive={false} />
        <Line dataKey="forecast" stroke={chartColors.forecast} strokeWidth={2} dot={false} isAnimationActive={false} />
        <Line
          dataKey="actual"
          stroke={chartColors.outturn}
          strokeWidth={1.5}
          strokeDasharray="5 4"
          dot={false}
          isAnimationActive={false}
        />
        <Scatter dataKey="below" fill={chartColors.risk} isAnimationActive={false} />
      </ComposedChart>
    </ResponsiveContainer>
  );
}
```

**`frontend/src/components/DecisionView.tsx`** (replace; new chart in a Panel, cards stay until Task 4)
```tsx
import { api } from "../api";
import { formatGwh, formatMw, formatUtc } from "../format";
import type { DecisionResponse } from "../types";
import { useAsync } from "../useAsync";
import { ChartLegend } from "./charts/ChartLegend";
import { DECISION_LEGEND, DecisionChart } from "./charts/DecisionChart";
import { Panel } from "./layout/Panel";
import { type Card, MetricCards } from "./MetricCards";

function shortfallAtRiskMwh(d: DecisionResponse): number | null {
  // Energy to cover if wind lands at the low (P10) bound; points are hourly so summed MW are MWh.
  if (d.points.length === 0 || d.points.some((p) => p.low_mw == null)) return null;
  return d.points.reduce((sum, p) => sum + (p.forecast_mw - (p.low_mw as number)), 0);
}

function decisionCards(d: DecisionResponse): Card[] {
  const atRisk = shortfallAtRiskMwh(d);
  return [
    { label: "Forecast wind energy", value: formatGwh(d.forecast_energy_mwh), hint: `delivery day ${d.delivery_date}` },
    { label: "Latest forecast before gate", value: formatUtc(d.forecast_published_at), hint: `gate closure ${formatUtc(d.gate_closure)}` },
    {
      label: "Shortfall at risk (P10)",
      value: formatGwh(atRisk),
      hint: atRisk == null ? "not enough history for a range yet" : `from ${d.band_samples} recent forecast/actual pairs`,
    },
    {
      label: "Actual wind energy",
      value: formatGwh(d.actual_energy_mwh),
      hint: d.metrics.n > 0 ? `hourly MAE ${formatMw(d.metrics.mae_mw)}` : "outturn not yet available",
    },
  ];
}

interface DecisionViewProps {
  deliveryDate: string;
  gateTime: string;
}

export function DecisionView({ deliveryDate, gateTime }: DecisionViewProps) {
  const decision = useAsync(() => api.decision(deliveryDate, gateTime), [deliveryDate, gateTime]);
  const d = decision.data;

  return (
    <section>
      {decision.error && <div className="error">{decision.error}</div>}
      {d && (
        <>
          <MetricCards cards={decisionCards(d)} />
          <Panel title="Wind forecast at gate closure vs outturn" legend={<ChartLegend items={DECISION_LEGEND} />}>
            <DecisionChart points={d.points} />
          </Panel>
        </>
      )}
    </section>
  );
}
```

- [ ] **Step 4: Run tests and build**

Run: `npm test && npm run build`
Expected: all tests pass and the build succeeds.

- [ ] **Step 5: Commit, push, deploy, check**

```bash
git add src
git commit -m "feat(ui): add chart theme, round ticks, custom tooltip and legend; restyle day-ahead chart"
git push origin main
cd .. && npx vercel deploy --prod --yes && cd frontend
```
Check the live day-ahead chart:
- The y-axis reads 0 / 5 / 10 / 15 / 20 GW.
- Blue forecast line, light blue range, dashed charcoal outturn.
- Amber dots where outturn fell below the range.
- The custom tooltip appears on hover, and the inline legend sits in the panel header.
- The chart appears without a draw-in animation.

---

### Task 4: Day-ahead page layout — header, summary rail, loading and error states

**Files:**
- Create: `frontend/src/components/layout/PageHeader.tsx`, `frontend/src/components/layout/PageHeader.module.css`, `frontend/src/components/feedback/ErrorPanel.tsx`, `frontend/src/components/feedback/ErrorPanel.module.css`, `frontend/src/components/feedback/Skeleton.tsx`, `frontend/src/components/feedback/Skeleton.module.css`, `frontend/src/components/decision/shortfall.ts`, `frontend/src/components/decision/SummaryRail.tsx`, `frontend/src/components/decision/SummaryRail.module.css`, `frontend/src/components/DecisionView.module.css`
- Replace: `frontend/src/useAsync.ts`, `frontend/src/components/DecisionView.tsx`
- Tests (replace/create): `frontend/src/components/DecisionView.test.tsx`, `frontend/src/components/decision/shortfall.test.ts`

**Interfaces:**
- Consumes: `Panel`, `ChartLegend`, `DecisionChart`, `DECISION_LEGEND` (Task 3); formatters (Task 1).
- Produces:
  - `useAsync<T>(load: () => Promise<T>, deps: DependencyList): { data: T | null; error: string | null; loading: boolean; reload: () => void }`. Previous data is kept while refetching.
  - Layout and feedback:
    - `PageHeader({ title: string; description?: string; status?: string })`
    - `ErrorPanel({ message: string; onRetry: () => void })`
    - `Skeleton({ height: number; width?: number | string })`
  - Decision:
    - `shortfallAtRiskMwh(d: DecisionResponse): number | null`
    - `SummaryRail({ decision: DecisionResponse })`
    - `decisionSummary(d: DecisionResponse): string` (exported from `DecisionView.tsx`)

- [ ] **Step 1: Write the failing tests**

**`frontend/src/components/decision/shortfall.test.ts`** (create)
```ts
import { decisionFixture } from "../../test/fixtures";
import { shortfallAtRiskMwh } from "./shortfall";

describe("shortfallAtRiskMwh", () => {
  it("sums forecast minus P10 over hourly points", () => {
    expect(shortfallAtRiskMwh(decisionFixture)).toBe(500);
  });
  it("is null when any hour has no range", () => {
    const points = [{ ...decisionFixture.points[0], low_mw: null, high_mw: null }, decisionFixture.points[1]];
    expect(shortfallAtRiskMwh({ ...decisionFixture, points })).toBeNull();
  });
  it("is null with no points", () => {
    expect(shortfallAtRiskMwh({ ...decisionFixture, points: [] })).toBeNull();
  });
});
```

**`frontend/src/components/DecisionView.test.tsx`** (replace)
```tsx
import { fireEvent, render, screen } from "@testing-library/react";
import { api } from "../api";
import { decisionFixture } from "../test/fixtures";
import { DecisionView } from "./DecisionView";

vi.mock("../api", () => ({
  api: { meta: vi.fn(), decision: vi.fn(), accuracy: vi.fn(), byHorizon: vi.fn() },
}));

beforeEach(() => {
  vi.mocked(api.decision).mockReset();
  vi.mocked(api.decision).mockResolvedValue(decisionFixture);
});

describe("DecisionView", () => {
  it("shows the shortfall, energy figures and forecast run in the rail", async () => {
    render(<DecisionView deliveryDate="2026-01-02" gateTime="09:20" />);
    expect(await screen.findByText("Shortfall at risk (P10)")).toBeInTheDocument();
    expect(api.decision).toHaveBeenCalledWith("2026-01-02", "09:20");
    // (1000-800) + (1200-900) = 500 MWh
    expect(screen.getByText("0.5 GWh")).toBeInTheDocument();
    expect(screen.getAllByText("2.2 GWh")).toHaveLength(2);
    expect(screen.getByText("Thu 1 Jan, 07:30 UTC")).toBeInTheDocument();
    expect(screen.getByText(/latest before the 09:20 gate/)).toBeInTheDocument();
  });

  it("explains when there is no likely range yet", async () => {
    const points = decisionFixture.points.map((p) => ({ ...p, low_mw: null, high_mw: null }));
    vi.mocked(api.decision).mockResolvedValue({ ...decisionFixture, points });
    render(<DecisionView deliveryDate="2026-01-02" gateTime="09:20" />);
    expect(await screen.findByText("Not enough history yet for a likely range.")).toBeInTheDocument();
    expect(screen.queryByText("Shortfall at risk (P10)")).not.toBeInTheDocument();
  });

  it("shows an error with a retry that refetches", async () => {
    vi.mocked(api.decision).mockRejectedValueOnce(new Error("boom"));
    render(<DecisionView deliveryDate="2026-01-15" gateTime="09:20" />);
    expect(await screen.findByText("Couldn't load the forecast for Thu 15 Jan 2026.")).toBeInTheDocument();
    fireEvent.click(screen.getByRole("button", { name: "Try again" }));
    expect(await screen.findByText("Shortfall at risk (P10)")).toBeInTheDocument();
    expect(api.decision).toHaveBeenCalledTimes(2);
  });

  it("keeps the last result and shows updating while refetching", async () => {
    const { rerender } = render(<DecisionView deliveryDate="2026-01-02" gateTime="09:20" />);
    await screen.findByText("Shortfall at risk (P10)");
    vi.mocked(api.decision).mockReturnValue(new Promise(() => {}));
    rerender(<DecisionView deliveryDate="2026-01-15" gateTime="09:50" />);
    expect(api.decision).toHaveBeenLastCalledWith("2026-01-15", "09:50");
    expect(await screen.findByText("Updating…")).toBeInTheDocument();
    expect(screen.getByText("Shortfall at risk (P10)")).toBeInTheDocument();
  });
});
```

- [ ] **Step 2: Run tests to verify they fail**

Run: `npx vitest run src/components/DecisionView.test.tsx src/components/decision`
Expected: FAIL. `./shortfall` can't be resolved, and the rail, error and updating texts aren't found.

- [ ] **Step 3: Write the hook, feedback components, rail and page**

**`frontend/src/useAsync.ts`** (replace)
```ts
import { type DependencyList, useCallback, useEffect, useState } from "react";

interface AsyncState<T> {
  data: T | null;
  error: string | null;
  loading: boolean;
}

/** Loads data when deps change; keeps the previous data while refetching so views can show it dimmed. */
export function useAsync<T>(load: () => Promise<T>, deps: DependencyList) {
  const [state, setState] = useState<AsyncState<T>>({ data: null, error: null, loading: true });
  const [attempt, setAttempt] = useState(0);

  useEffect(() => {
    let cancelled = false;
    setState((s) => ({ ...s, loading: true, error: null }));
    load()
      .then((data) => !cancelled && setState({ data, error: null, loading: false }))
      .catch((e: Error) => !cancelled && setState((s) => ({ ...s, error: e.message, loading: false })));
    return () => {
      cancelled = true;
    };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [...deps, attempt]);

  const reload = useCallback(() => setAttempt((n) => n + 1), []);
  return { ...state, reload };
}
```

**`frontend/src/components/layout/PageHeader.tsx`** (create)
```tsx
import s from "./PageHeader.module.css";

interface PageHeaderProps {
  title: string;
  description?: string;
  status?: string;
}

export function PageHeader({ title, description, status }: PageHeaderProps) {
  return (
    <div className={s.header}>
      <h1 className={s.title}>{title}</h1>
      {status && (
        <span className={s.status} role="status">
          {status}
        </span>
      )}
      {description && <p className={s.description}>{description}</p>}
    </div>
  );
}
```

**`frontend/src/components/layout/PageHeader.module.css`** (create)
```css
.header {
  display: flex;
  align-items: baseline;
  flex-wrap: wrap;
  gap: var(--space-1) var(--space-3);
  margin-bottom: var(--space-5);
}
.title {
  font-size: var(--text-xl);
}
.status {
  font-size: var(--text-xs);
  color: var(--text-3);
}
.description {
  flex-basis: 100%;
  color: var(--text-2);
}
```

**`frontend/src/components/feedback/ErrorPanel.tsx`** (create)
```tsx
import s from "./ErrorPanel.module.css";

interface ErrorPanelProps {
  message: string;
  onRetry: () => void;
}

export function ErrorPanel({ message, onRetry }: ErrorPanelProps) {
  return (
    <div className={s.error} role="alert">
      <p>{message}</p>
      <button type="button" className={s.retry} onClick={onRetry}>
        Try again
      </button>
    </div>
  );
}
```

**`frontend/src/components/feedback/ErrorPanel.module.css`** (create)
```css
.error {
  display: flex;
  justify-content: space-between;
  align-items: center;
  gap: var(--space-4);
  padding: var(--space-4) var(--space-5);
  background: var(--danger-bg);
  color: var(--danger);
  border-radius: var(--radius-panel);
}
.retry {
  height: 34px;
  padding: 0 var(--space-4);
  border: 1px solid currentColor;
  border-radius: var(--radius-control);
  background: transparent;
  color: inherit;
  cursor: pointer;
}
```

**`frontend/src/components/feedback/Skeleton.tsx`** (create)
```tsx
import s from "./Skeleton.module.css";

export function Skeleton({ height, width = "100%" }: { height: number; width?: number | string }) {
  return <div className={s.skeleton} style={{ height, width }} aria-hidden="true" />;
}
```

**`frontend/src/components/feedback/Skeleton.module.css`** (create)
```css
.skeleton {
  border-radius: 8px;
  background: linear-gradient(90deg, var(--surface) 0%, #efeee9 50%, var(--surface) 100%);
  background-size: 200% 100%;
  animation: shimmer 1.4s ease-in-out infinite;
}
@keyframes shimmer {
  from {
    background-position: 200% 0;
  }
  to {
    background-position: -200% 0;
  }
}
@media (prefers-reduced-motion: reduce) {
  .skeleton {
    animation: none;
  }
}
```

**`frontend/src/components/decision/shortfall.ts`** (create)
```ts
import type { DecisionResponse } from "../../types";

/** Energy to cover if wind lands at the P10 bound. Points are hourly, so summed MW are MWh. */
export function shortfallAtRiskMwh(d: DecisionResponse): number | null {
  if (d.points.length === 0 || d.points.some((p) => p.low_mw == null)) return null;
  return d.points.reduce((sum, p) => sum + (p.forecast_mw - (p.low_mw as number)), 0);
}
```

**`frontend/src/components/decision/SummaryRail.tsx`** (create)
```tsx
import { formatDayHour, formatGwh, formatMw } from "../../format";
import type { DecisionResponse } from "../../types";
import { shortfallAtRiskMwh } from "./shortfall";
import s from "./SummaryRail.module.css";

export function SummaryRail({ decision: d }: { decision: DecisionResponse }) {
  const atRisk = shortfallAtRiskMwh(d);
  return (
    <aside className={s.rail} aria-label="Decision summary">
      {atRisk == null ? (
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
```

**`frontend/src/components/decision/SummaryRail.module.css`** (create)
```css
.rail {
  display: flex;
  flex-direction: column;
  gap: var(--space-5);
  padding: var(--space-5);
  background: var(--surface);
  border: 1px solid var(--border);
  border-radius: var(--radius-panel);
}
.risk {
  padding: var(--space-4);
  background: var(--risk-bg);
  border-radius: 8px;
}
.riskLabel {
  font-size: var(--text-sm);
  color: var(--risk);
}
.riskValue {
  margin-top: var(--space-1);
  font-size: var(--text-2xl);
  font-weight: 500;
  line-height: 1.2;
  color: var(--risk);
}
.riskCaption {
  margin-top: var(--space-2);
  font-size: var(--text-xs);
  color: var(--text-2);
}
.noRange {
  padding: var(--space-4);
  font-size: var(--text-sm);
  color: var(--text-2);
  background: var(--bg);
  border: 1px dashed var(--border-strong);
  border-radius: 8px;
}
.figures {
  display: flex;
  flex-direction: column;
  gap: var(--space-4);
  margin: 0;
}
.figures dt {
  font-size: var(--text-sm);
  color: var(--text-2);
}
.figures dd {
  margin: 2px 0 0;
  font-size: var(--text-xl);
  font-weight: 500;
}
.missing {
  font-size: var(--text-sm);
  font-weight: 400;
  color: var(--text-3);
}
.meta {
  display: grid;
  grid-template-columns: auto 1fr;
  gap: var(--space-1) var(--space-3);
  margin: 0;
  padding-top: var(--space-4);
  border-top: 1px solid var(--border);
  font-size: var(--text-xs);
}
.meta > div {
  display: contents;
}
.meta dt {
  color: var(--text-3);
}
.meta dd {
  margin: 0;
  color: var(--text-2);
  text-align: right;
}
```

**`frontend/src/components/DecisionView.module.css`** (create)
```css
.layout {
  display: grid;
  grid-template-columns: minmax(0, 1fr) 280px;
  gap: var(--space-5);
  align-items: start;
  transition: opacity 150ms ease;
}
.layout[aria-busy="true"] {
  opacity: 0.55;
}
.skeletonRail {
  display: flex;
  flex-direction: column;
  gap: var(--space-4);
}
@media (max-width: 900px) {
  .layout {
    grid-template-columns: minmax(0, 1fr);
  }
}
```

**`frontend/src/components/DecisionView.tsx`** (replace)
```tsx
import { api } from "../api";
import { formatDayLong, formatHourUtc, formatWeekdayDay } from "../format";
import type { DecisionResponse } from "../types";
import { useAsync } from "../useAsync";
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
  const decision = useAsync(() => api.decision(deliveryDate, gateTime), [deliveryDate, gateTime]);
  const d = decision.data;

  if (decision.error) {
    return (
      <>
        <PageHeader title={TITLE} />
        <ErrorPanel message={`Couldn't load the forecast for ${formatDayLong(deliveryDate)}.`} onRetry={decision.reload} />
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
```

- [ ] **Step 4: Run tests and build**

Run: `npm test && npm run build`
Expected: all tests pass (App tests still find "Shortfall at risk (P10)" in the rail) and the build succeeds.

- [ ] **Step 5: Commit, push, deploy, check**

```bash
git add src
git commit -m "feat(ui): day-ahead page with summary rail, page header, skeletons and retryable errors"
git push origin main
cd .. && npx vercel deploy --prod --yes && cd frontend
```
Check the live site:
- The day-ahead page shows the header sentence, with the chart on the left and the rail on the right: the amber shortfall figure, then the energy figures, then the metadata.
- Stepping days dims the content and shows "Updating…".
- Below 900 px wide, the rail stacks under the chart.

---

### Task 5: Accuracy page — metric strip, restyled charts; remove legacy styles

**Files:**
- Create: `frontend/src/components/accuracy/MetricStrip.tsx`, `frontend/src/components/accuracy/MetricStrip.module.css`, `frontend/src/components/charts/AccuracySeriesChart.tsx`, `frontend/src/components/charts/ErrorHistogram.tsx`, `frontend/src/components/charts/HorizonChart.tsx`, `frontend/src/components/AccuracyView.module.css`
- Replace: `frontend/src/components/AccuracyView.tsx`, `frontend/src/main.tsx`, `frontend/src/components/AccuracyView.test.tsx`
- Delete: `frontend/src/index.css`, `frontend/src/components/MetricCards.tsx`
- Modify: `README.md` (files table row for `frontend/src/components/`)

**Interfaces:**
- Consumes:
  - From Task 3: `chartColors`, `gridProps`, `axisProps`, `niceTicks`, `weeklyTicks`, `ChartTooltip`, `ChartLegend`, `Panel`.
  - From Task 4: `PageHeader`, `ErrorPanel`, `Skeleton`, `useAsync` with `reload`.
  - From Task 1: formatters.
- Produces:
  - `Metric = { label: string; value: string; note: string }` and `MetricStrip({ metrics: Metric[] })`
  - `AccuracySeriesChart({ points: AccuracyPoint[] })`
  - `ErrorHistogram({ bins: HistogramBin[] })`
  - `HorizonChart({ rows: HorizonRow[]; selected: number })`

- [ ] **Step 1: Write the failing tests**

**`frontend/src/components/AccuracyView.test.tsx`** (replace)
```tsx
import { fireEvent, render, screen } from "@testing-library/react";
import { api } from "../api";
import { accuracyFixture, horizonFixture } from "../test/fixtures";
import { AccuracyView } from "./AccuracyView";

vi.mock("../api", () => ({
  api: { meta: vi.fn(), decision: vi.fn(), accuracy: vi.fn(), byHorizon: vi.fn() },
}));

beforeEach(() => {
  vi.mocked(api.accuracy).mockReset();
  vi.mocked(api.accuracy).mockResolvedValue(accuracyFixture);
  vi.mocked(api.byHorizon).mockResolvedValue(horizonFixture);
});

describe("AccuracyView", () => {
  it("shows the metric strip for the requested horizon", async () => {
    render(<AccuracyView horizon={24} />);
    expect(await screen.findByText("Mean absolute error")).toBeInTheDocument();
    expect(api.accuracy).toHaveBeenCalledWith(24);
    expect(screen.getByText("512 MW")).toBeInTheDocument();
    expect(screen.getByText("6.2%")).toBeInTheDocument();
    expect(screen.getByText(/at least 24 h before each hour/)).toBeInTheDocument();
    expect(await screen.findByText("How error grows with lead time")).toBeInTheDocument();
  });

  it("keeps results and shows updating while a new horizon loads", async () => {
    const { rerender } = render(<AccuracyView horizon={24} />);
    await screen.findByText("Mean absolute error");
    vi.mocked(api.accuracy).mockReturnValue(new Promise(() => {}));
    rerender(<AccuracyView horizon={6} />);
    expect(api.accuracy).toHaveBeenLastCalledWith(6);
    expect(await screen.findByText("Updating…")).toBeInTheDocument();
    expect(screen.getByText("512 MW")).toBeInTheDocument();
  });

  it("shows an error with a retry", async () => {
    vi.mocked(api.accuracy).mockRejectedValueOnce(new Error("boom"));
    render(<AccuracyView horizon={12} />);
    expect(await screen.findByText("Couldn't load accuracy for the 12 h horizon.")).toBeInTheDocument();
    fireEvent.click(screen.getByRole("button", { name: "Try again" }));
    expect(await screen.findByText("Mean absolute error")).toBeInTheDocument();
  });
});
```

- [ ] **Step 2: Run tests to verify they fail**

Run: `npx vitest run src/components/AccuracyView.test.tsx`
Expected: FAIL. The header sentence, "Updating…" and the error message aren't found.

- [ ] **Step 3: Write the strip, charts and page; remove legacy files**

**`frontend/src/components/accuracy/MetricStrip.tsx`** (create)
```tsx
import s from "./MetricStrip.module.css";

export interface Metric {
  label: string;
  value: string;
  note: string;
}

export function MetricStrip({ metrics }: { metrics: Metric[] }) {
  return (
    <dl className={s.strip}>
      {metrics.map((m) => (
        <div key={m.label} className={s.cell}>
          <dt className={s.label}>{m.label}</dt>
          <dd className={s.value}>{m.value}</dd>
          <dd className={s.note}>{m.note}</dd>
        </div>
      ))}
    </dl>
  );
}
```

**`frontend/src/components/accuracy/MetricStrip.module.css`** (create)
```css
.strip {
  display: grid;
  grid-template-columns: repeat(5, minmax(0, 1fr));
  margin: 0;
  background: var(--bg);
  border: 1px solid var(--border);
  border-radius: var(--radius-panel);
}
.cell {
  padding: var(--space-4) var(--space-5);
  border-left: 1px solid var(--border);
}
.cell:first-child {
  border-left: 0;
}
.label {
  font-size: var(--text-sm);
  color: var(--text-2);
}
.value {
  margin: var(--space-1) 0 0;
  font-size: var(--text-xl);
  font-weight: 500;
}
.note {
  margin: 2px 0 0;
  font-size: var(--text-xs);
  color: var(--text-3);
}
@media (max-width: 900px) {
  .strip {
    grid-template-columns: repeat(2, minmax(0, 1fr));
  }
  .cell {
    border-left: 0;
    border-top: 1px solid var(--border);
  }
  .cell:first-child,
  .cell:nth-child(2) {
    border-top: 0;
  }
}
```

**`frontend/src/components/charts/AccuracySeriesChart.tsx`** (create)
```tsx
import { CartesianGrid, Line, LineChart, ResponsiveContainer, Tooltip, XAxis, YAxis } from "recharts";
import { formatDayHour, formatDayShort, formatGw, formatGwDelta, formatGwTick } from "../../format";
import type { AccuracyPoint } from "../../types";
import { ChartTooltip, type TooltipLine } from "./ChartTooltip";
import { axisProps, chartColors, gridProps } from "./chartTheme";
import { niceTicks, weeklyTicks } from "./ticks";

interface SeriesRow {
  startTime: string;
  forecast: number;
  actual: number | null;
  error: number | null;
}

const lines = (r: SeriesRow): TooltipLine[] => [
  { label: "Forecast", value: formatGw(r.forecast), color: chartColors.forecast },
  { label: "Outturn", value: formatGw(r.actual), color: chartColors.outturn, kind: "dashed" },
  { label: "Error", value: formatGwDelta(r.error), color: chartColors.risk },
];

export function AccuracySeriesChart({ points }: { points: AccuracyPoint[] }) {
  const rows: SeriesRow[] = points.map((p) => ({
    startTime: p.start_time,
    forecast: p.forecast_mw,
    actual: p.actual_mw,
    error: p.error_mw,
  }));
  const max = Math.max(0, ...points.flatMap((p) => [p.forecast_mw, p.actual_mw ?? 0]));
  const yTicks = niceTicks(0, max);

  return (
    <ResponsiveContainer width="100%" height={300}>
      <LineChart data={rows} margin={{ top: 8, right: 8, bottom: 0, left: 0 }}>
        <CartesianGrid {...gridProps} />
        <XAxis
          dataKey="startTime"
          ticks={weeklyTicks(rows.map((r) => r.startTime))}
          interval={0}
          tickFormatter={formatDayShort}
          {...axisProps}
        />
        <YAxis ticks={yTicks} domain={[yTicks[0], yTicks[yTicks.length - 1]]} tickFormatter={formatGwTick} width={52} {...axisProps} />
        <Tooltip
          cursor={{ stroke: chartColors.grid }}
          content={<ChartTooltip<SeriesRow> title={(r) => formatDayHour(r.startTime)} lines={lines} />}
        />
        <Line dataKey="forecast" stroke={chartColors.forecast} strokeWidth={1.5} dot={false} isAnimationActive={false} />
        <Line
          dataKey="actual"
          stroke={chartColors.outturn}
          strokeWidth={1.25}
          strokeDasharray="4 3"
          dot={false}
          isAnimationActive={false}
        />
      </LineChart>
    </ResponsiveContainer>
  );
}
```

**`frontend/src/components/charts/ErrorHistogram.tsx`** (create)
```tsx
import { Bar, BarChart, CartesianGrid, Cell, ReferenceLine, ResponsiveContainer, Tooltip, XAxis, YAxis } from "recharts";
import { formatGwDelta, formatGwSigned } from "../../format";
import type { HistogramBin } from "../../types";
import { ChartTooltip, type TooltipLine } from "./ChartTooltip";
import { axisProps, chartColors, gridProps } from "./chartTheme";

interface BinRow {
  start: number;
  end: number;
  count: number;
}

const barColor = (r: BinRow): string => (r.start >= 0 ? chartColors.risk : chartColors.neutralBar);

const lines = (r: BinRow): TooltipLine[] => [{ label: "Hours", value: String(r.count), color: barColor(r), kind: "area" }];

export function ErrorHistogram({ bins }: { bins: HistogramBin[] }) {
  const rows: BinRow[] = bins.map((b) => ({ start: b.bin_start_mw, end: b.bin_end_mw, count: b.count }));
  const xTicks = rows.filter((r) => r.start % 1000 === 0).map((r) => r.start);

  return (
    <ResponsiveContainer width="100%" height={260}>
      <BarChart data={rows} margin={{ top: 8, right: 8, bottom: 0, left: 0 }} barCategoryGap={1}>
        <CartesianGrid {...gridProps} />
        <XAxis dataKey="start" ticks={xTicks} interval={0} tickFormatter={formatGwSigned} {...axisProps} />
        <YAxis allowDecimals={false} width={36} {...axisProps} />
        <Tooltip
          cursor={{ fill: "rgba(28, 28, 26, 0.04)" }}
          content={
            <ChartTooltip<BinRow> title={(r) => `${formatGwDelta(r.start)} to ${formatGwDelta(r.end)}`} lines={lines} />
          }
        />
        <ReferenceLine x={0} stroke={chartColors.outturn} strokeWidth={1} />
        <Bar dataKey="count" isAnimationActive={false}>
          {rows.map((r) => (
            <Cell key={r.start} fill={barColor(r)} />
          ))}
        </Bar>
      </BarChart>
    </ResponsiveContainer>
  );
}
```

**`frontend/src/components/charts/HorizonChart.tsx`** (create)
```tsx
import { Area, CartesianGrid, ComposedChart, Line, ReferenceLine, ResponsiveContainer, Tooltip, XAxis, YAxis } from "recharts";
import { formatGw, formatGwRange, formatGwTick } from "../../format";
import type { HorizonRow } from "../../types";
import { ChartTooltip, type TooltipLine } from "./ChartTooltip";
import { axisProps, chartColors, gridProps } from "./chartTheme";
import { niceTicks } from "./ticks";

interface Row {
  horizon: number;
  mae: number | null;
  band: [number, number] | null;
}

const lines = (r: Row): TooltipLine[] => {
  const out: TooltipLine[] = [{ label: "MAE", value: formatGw(r.mae), color: chartColors.forecast }];
  if (r.band) out.push({ label: "P10–P90 error", value: formatGwRange(r.band[0], r.band[1]), color: chartColors.forecast, kind: "area" });
  return out;
};

export function HorizonChart({ rows, selected }: { rows: HorizonRow[]; selected: number }) {
  const data: Row[] = rows.map((r) => ({
    horizon: r.horizon_hours,
    mae: r.metrics.mae_mw,
    band: r.p10_error_mw != null && r.p90_error_mw != null ? [r.p10_error_mw, r.p90_error_mw] : null,
  }));
  const lows = rows.map((r) => r.p10_error_mw ?? 0);
  const highs = rows.flatMap((r) => [r.p90_error_mw ?? 0, r.metrics.mae_mw ?? 0]);
  const yTicks = niceTicks(Math.min(0, ...lows), Math.max(0, ...highs));

  return (
    <ResponsiveContainer width="100%" height={260}>
      <ComposedChart data={data} margin={{ top: 16, right: 8, bottom: 0, left: 0 }}>
        <CartesianGrid {...gridProps} />
        <XAxis
          dataKey="horizon"
          type="number"
          domain={[0, 48]}
          ticks={[0, 6, 12, 18, 24, 30, 36, 42, 48]}
          tickFormatter={(h: number) => `${h} h`}
          {...axisProps}
        />
        <YAxis ticks={yTicks} domain={[yTicks[0], yTicks[yTicks.length - 1]]} tickFormatter={formatGwTick} width={52} {...axisProps} />
        <Tooltip
          cursor={{ stroke: chartColors.grid }}
          content={<ChartTooltip<Row> title={(r) => `${r.horizon} h ahead`} lines={lines} />}
        />
        <Area dataKey="band" fill={chartColors.forecastRange} stroke="none" activeDot={false} isAnimationActive={false} />
        <Line dataKey="mae" stroke={chartColors.forecast} strokeWidth={2} dot={false} isAnimationActive={false} />
        <ReferenceLine
          x={selected}
          stroke={chartColors.forecast}
          strokeDasharray="3 3"
          label={{ value: "Selected", position: "top", fill: chartColors.forecast, fontSize: 12 }}
        />
      </ComposedChart>
    </ResponsiveContainer>
  );
}
```

**`frontend/src/components/AccuracyView.module.css`** (create)
```css
.content {
  display: flex;
  flex-direction: column;
  gap: var(--space-5);
  transition: opacity 150ms ease;
}
.content[aria-busy="true"] {
  opacity: 0.55;
}
.row {
  display: grid;
  grid-template-columns: repeat(2, minmax(0, 1fr));
  gap: var(--space-5);
}
@media (max-width: 900px) {
  .row {
    grid-template-columns: minmax(0, 1fr);
  }
}
```

**`frontend/src/components/AccuracyView.tsx`** (replace)
```tsx
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
```

**`frontend/src/main.tsx`** (replace; legacy `index.css` import removed)
```tsx
import "@fontsource/ibm-plex-sans/400.css";
import "@fontsource/ibm-plex-sans/500.css";
import { StrictMode } from "react";
import { createRoot } from "react-dom/client";
import App from "./App";
import "./styles/tokens.css";
import "./styles/base.css";

createRoot(document.getElementById("root")!).render(
  <StrictMode>
    <App />
  </StrictMode>,
);
```

Delete the legacy files:
```bash
git rm src/index.css src/components/MetricCards.tsx
```

In `README.md`, replace the row
`| \`frontend/src/components/\` | \`DecisionView\`, \`AccuracyView\`, \`MetricCards\` (+ tests) |`
with
`| \`frontend/src/components/\` | Page views (\`DecisionView\`, \`AccuracyView\`) and their building blocks: \`layout/\`, \`controls/\`, \`charts/\`, \`decision/\`, \`accuracy/\`, \`feedback/\` (+ tests) |`
and add the row `| \`frontend/src/styles/\` | Design tokens and base styles |` directly below it.

- [ ] **Step 4: Run tests and build; confirm nothing references removed files**

Run: `npm test && npm run build && grep -rn "MetricCards\|index.css\|className=\"\(panel\|cards\|error\|grid-2\|controls\)\"" src || echo "no legacy references"`
Expected: all tests pass, the build succeeds, and the grep prints `no legacy references`.

- [ ] **Step 5: Commit, push, deploy, check**

```bash
git add -A src ../README.md
git commit -m "feat(ui): accuracy page with metric strip and restyled charts; remove legacy styles"
git push origin main
cd .. && npx vercel deploy --prod --yes && cd frontend
```
Check the live accuracy tab:
- The metric strip shows five cells with dividers.
- The series chart has weekly date ticks.
- Histogram bars are amber right of zero and grey left of it.
- The lead-time chart has a "Selected" marker that follows the slider.
- Both pages share the same look.
