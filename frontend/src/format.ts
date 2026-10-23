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
