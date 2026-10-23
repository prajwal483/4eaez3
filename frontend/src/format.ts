const DASH = "—";
const MONTHS = ["Jan", "Feb", "Mar", "Apr", "May", "Jun", "Jul", "Aug", "Sep", "Oct", "Nov", "Dec"];

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
