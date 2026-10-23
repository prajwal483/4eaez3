const STEP_MULTIPLIERS = [1, 2, 2.5, 5, 10];

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

export function weeklyTicks(times: string[]): string[] {
  return times.filter((t) => {
    const d = new Date(t);
    return d.getUTCDay() === 1 && d.getUTCHours() === 0 && d.getUTCMinutes() === 0;
  });
}
