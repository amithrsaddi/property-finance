export function todayIso(): string {
  return new Date().toISOString().slice(0, 10);
}

export function startOfMonth(date = new Date()): string {
  return new Date(Date.UTC(date.getUTCFullYear(), date.getUTCMonth(), 1))
    .toISOString()
    .slice(0, 10);
}

export function endOfMonth(date = new Date()): string {
  return new Date(Date.UTC(date.getUTCFullYear(), date.getUTCMonth() + 1, 0))
    .toISOString()
    .slice(0, 10);
}

export function startOfYear(date = new Date()): string {
  return `${date.getUTCFullYear()}-01-01`;
}

export function endOfYear(date = new Date()): string {
  return `${date.getUTCFullYear()}-12-31`;
}

export function parseDateRange(query: {
  from?: string;
  to?: string;
  month?: string;
  year?: string;
}): { from: string; to: string } {
  if (query.from && query.to) {
    return { from: query.from, to: query.to };
  }

  if (query.month) {
    const [y, m] = query.month.split("-").map(Number);
    const from = new Date(Date.UTC(y, m - 1, 1)).toISOString().slice(0, 10);
    const to = new Date(Date.UTC(y, m, 0)).toISOString().slice(0, 10);
    return { from, to };
  }

  if (query.year) {
    return { from: `${query.year}-01-01`, to: `${query.year}-12-31` };
  }

  return { from: startOfMonth(), to: endOfMonth() };
}

export function addMonths(isoDate: string, months: number): string {
  const d = new Date(`${isoDate}T00:00:00.000Z`);
  d.setUTCMonth(d.getUTCMonth() + months);
  return d.toISOString().slice(0, 10);
}

export function clampDay(year: number, monthIndex: number, day: number): string {
  const lastDay = new Date(Date.UTC(year, monthIndex + 1, 0)).getUTCDate();
  const safeDay = Math.min(Math.max(day, 1), lastDay);
  return new Date(Date.UTC(year, monthIndex, safeDay)).toISOString().slice(0, 10);
}

export function sum(values: Array<number | null | undefined>): number {
  return values.reduce<number>((acc, value) => acc + (Number(value) || 0), 0);
}
