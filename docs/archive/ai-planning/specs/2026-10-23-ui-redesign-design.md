# UI redesign — design spec

**Goal:** Make the GridBrick front end look like a deliberately designed product rather than a generated template, without changing the data, the API, or what each page does.

**Decisions taken in brainstorming**
- Direction: polished SaaS, light theme only.
- Scope: new layout plus a design system. No new features.
- Layout B: a top bar holding the navigation and the current page's controls. On the day-ahead page, the chart sits on the left and a summary rail on the right.

## 1. Visual system

**Typography**
- Font: IBM Plex Sans, self-hosted through `@fontsource/ibm-plex-sans` (weights 400 and 500). No Google Fonts request.
- Numbers use tabular figures everywhere (`font-variant-numeric: tabular-nums`).
- Size scale: 12, 13, 14, 16, 20, 28 px.
- Two weights only: 400 and 500.
- Sentence case throughout. No uppercase micro-labels.

**Colour tokens** (defined once in `frontend/src/styles/tokens.css`)

| Token | Value | Use |
|---|---|---|
| `--bg` | `#ffffff` | Page |
| `--surface` | `#f7f7f5` | Rail, panel headers, strips |
| `--border` | `#e6e5e1` | 1 px hairlines |
| `--border-strong` | `#d3d1c9` | Controls |
| `--text` | `#1c1c1a` | Primary text |
| `--text-2` | `#5f5e5a` | Secondary text |
| `--text-3` | `#8a8984` | Captions, metadata, axis labels |
| `--forecast` | `#1f5fbf` | Forecast series, active tab, focus ring |
| `--forecast-range` | `rgba(31, 95, 191, 0.12)` | P10–P90 band |
| `--outturn` | `#3d3d3a` | Outturn series (dashed) |
| `--risk` | `#b45309` | Shortfall at risk, below-range markers, over-forecast bars |
| `--risk-bg` | `#fdf3e7` | Background behind the risk figure |
| `--neutral-bar` | `#b4b2a9` | Under-forecast histogram bars |
| `--danger` / `--danger-bg` | `#a32d2d` / `#fcebeb` | Error messages |

**Shape and space**
- Spacing on a 4 px grid, using tokens `--space-1` to `--space-8`, which are 4, 8, 12, 16, 20, 24, 32 and 40 px.
- Corner radius: 6 px for controls, 10 px for panels. No pills.
- No drop shadows, except a single `--shadow-tooltip` on the chart tooltip.

**CSS approach**
- `tokens.css` holds the variables.
- `base.css` holds the reset, body font, focus ring and number styling. It replaces `index.css`.
- Each component has a `*.module.css` file (Vite CSS modules, no new tooling).
- The only new dependency is `@fontsource/ibm-plex-sans`.

## 2. Layout and components

**App shell**
- `TopBar` contains:
  - the wordmark (Tabler-style wind glyph as inline SVG, then "GridBrick");
  - tabs "Day-ahead decision" and "Forecast accuracy", with the active tab shown by a 2 px underline in `--forecast` and `aria-current="page"`;
  - a right-hand `controls` slot.
- `App` owns the page state (`tab`, `deliveryDate`, `gateTime`, `horizon`) and passes the matching controls into the top bar. Views receive their values as props.
- Footer: one muted line naming the data source and saying that times are UTC.
- Max content width is 1200 px. Below 900 px, the summary rail stacks under the chart and the top-bar controls wrap onto a second row.

**Controls** (`components/controls/`)
- `Select`: a native `<select>` restyled with tokens and a chevron, with a visible `<label>` that can be visually hidden where the context is obvious.
- `DayStepper`:
  - previous and next icon buttons with `aria-label`s, either side of a `Select` of delivery days;
  - labels read "Thu 15 Jan 2026";
  - previous is disabled on the first day and next on the last day.
- Gate closure: a `Select` with the three auction options already in use (09:20 EPEX 60-min, 09:50 N2EX, 15:30 EPEX 30-min).
- `HorizonSlider`: a styled `<input type="range">` (0–48, step 1) with the value shown beside it, e.g. "24 h ahead".

**Day-ahead decision page** (`DecisionView`)
- Page header: the title "Day-ahead decision", plus one plain sentence such as "Forecast run 07:30 UTC on Wed 14 Jan, the latest before the 09:20 gate."
- Body: a two-column grid, `minmax(0, 1fr) 280px`.
  - **Chart panel:** a header with title and inline legend (forecast, likely range, outturn, below range), then `DecisionChart`.
  - **Summary rail** (`SummaryRail`), in this order:
    1. Shortfall at risk (P10), 28 px in `--risk` on `--risk-bg`, with a caption naming the sample count.
    2. Forecast wind energy.
    3. Outturn energy, with "outturn not yet available" when missing.
    4. Hourly MAE.
    5. A metadata block: forecast run, gate closure, range samples.
  - With no range (too little history), the risk figure is replaced by the sentence "Not enough history yet for a likely range."

**Forecast accuracy page** (`AccuracyView`)
- Page header: "Forecast accuracy", plus "Forecast available at least N h before each hour, January 2026 delivery."
- `MetricStrip`: one bordered strip with five cells separated by dividers, each with a label, value and a one-line explanation. The cells are MAE, RMSE, bias, WAPE and P90 absolute error. It replaces `MetricCards`.
- A full-width panel with `AccuracySeriesChart` (actual vs forecast).
- A two-column row with an `ErrorHistogram` panel and a `HorizonChart` panel. It stacks below 900 px.

## 3. Charts

**Library**
- Keep Recharts. Every default is overridden through one module, `components/charts/chartTheme.ts`, which mirrors the colour tokens as TS constants. Recharts needs literal values, and a comment points back to `tokens.css`.

**Shared behaviour**
- `niceTicks(max, targetCount)` is a pure function returning round tick values from 0. It uses steps of 1, 2, 2.5 or 5 × 10ⁿ MW and is shown in GW, e.g. 0, 5, 10, 15, 20 GW.
- Horizontal gridlines only, hairline `--border`. No axis lines, no tick lines.
- Axis labels are 12 px in `--text-3`.
- `isAnimationActive={false}` on every series.
- `ChartTooltip` is a custom component: a time header ("Thu 15 Jan, 14:00"), a row per series with a swatch, and right-aligned tabular values. The range shows as "11.0–16.6 GW".
- `ChartLegend` is an inline HTML legend in the panel header. Recharts `<Legend>` is not used.

**Per chart**
- `DecisionChart`:
  - range as an `Area` in `--forecast-range`;
  - forecast as a 2 px solid `--forecast` line;
  - outturn as a 1.5 px dashed `--outturn` line;
  - amber dots on hours where outturn is below the range low, computed by the pure helper `belowRangeHours(points)`;
  - x ticks every 3 h ("00:00", "03:00", …).
- `AccuracySeriesChart`: forecast and outturn lines in the same styles, with x ticks at midnight on 5, 12, 19 and 26 Jan, labelled "5 Jan".
- `ErrorHistogram`:
  - bars per bin, labelled in GW ("−1", "0", "+1");
  - bars with `bin_start_mw >= 0` (over-forecast, so the buyer is short) in `--risk`, others in `--neutral-bar`;
  - a `ReferenceLine` at 0.
- `HorizonChart`: an MAE line in `--forecast` over a P10–P90 `Area` in `--forecast-range`, with a `ReferenceLine` at the slider's current horizon labelled "Selected".

## 4. States, errors and testing

**Loading**
- First load: skeleton blocks the size of the rail figures and the chart panel.
- Refetches (stepping days, moving the slider): the previous content stays, dimmed (`aria-busy="true"`), with an "Updating…" note in the page header.
- This fixes the review finding that fast slider moves briefly showed cards and charts from different horizons.

**Errors**
- An inline panel in `--danger-bg` says what failed in one sentence, for example "Couldn't load the forecast for Thu 15 Jan." It has a "Try again" button that refetches.
- `useAsync` gains a `reload()` function for this.

**Tests** (Vitest + Testing Library; existing suites are updated for new labels)
- Unit tests for `niceTicks` (round steps, the 0 start, small and large maxima), `belowRangeHours`, and the new date formatters ("Thu 15 Jan 2026", "Thu 15 Jan, 14:00").
- `DayStepper`: previous/next change the date; buttons are disabled at the window ends.
- `DecisionView`:
  - the rail shows the shortfall figure;
  - the no-range sentence appears when `low_mw` is null;
  - the error panel shows and "Try again" refetches.
- `AccuracyView`: metric strip values render; the slider refetches; the "Updating…" state appears while loading.
- `App`: tab switching; controls in the top bar follow the active tab.
- After each implementation step, check in the browser and push. App changes are redeployed to https://4eaez3.vercel.app.

## Out of scope
- New metrics, endpoints or backend changes.
- Dark mode.
- Mobile-specific layouts beyond the 900 px stacking rule.
- Chart zoom or brushing.
