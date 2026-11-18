export const uid = (): string => crypto.randomUUID();
export const nowIso = (): string => new Date().toISOString();

export function normName(s: string): string {
  return s
    .toLowerCase()
    .replace(/[^a-z0-9 ]+/g, ' ')
    .replace(/\s+/g, ' ')
    .trim()
    .replace(/(s|es)$/, ''); // crude singular: "t-shirts" == "t shirt"
}

export function todayStr(d = new Date()): string {
  const y = d.getFullYear();
  const m = String(d.getMonth() + 1).padStart(2, '0');
  const day = String(d.getDate()).padStart(2, '0');
  return `${y}-${m}-${day}`;
}

export function parseDay(s: string): Date {
  const [y, m, d] = s.split('-').map(Number);
  return new Date(y, (m || 1) - 1, d || 1);
}

export function daysBetween(a: string, b: string): number {
  return Math.round((parseDay(b).getTime() - parseDay(a).getTime()) / 86400000);
}

export function nightsOf(start: string, end: string): number {
  return Math.max(0, daysBetween(start, end));
}

export function fmtRange(start: string, end: string): string {
  const s = parseDay(start);
  const e = parseDay(end);
  const sm = s.toLocaleString('en-IN', { month: 'short' });
  const em = e.toLocaleString('en-IN', { month: 'short' });
  const days = nightsOf(start, end) + 1;
  if (sm === em && s.getFullYear() === e.getFullYear())
    return `${s.getDate()} – ${e.getDate()} ${em} (${days} day${days > 1 ? 's' : ''})`;
  return `${s.getDate()} ${sm} – ${e.getDate()} ${em} (${days} days)`;
}

export function countdown(start: string): { label: string; days: number } {
  const d = daysBetween(todayStr(), start);
  if (d > 1) return { label: `In ${d} days`, days: d };
  if (d === 1) return { label: 'Tomorrow', days: 1 };
  if (d === 0) return { label: 'Today', days: 0 };
  return { label: `${-d}d ago`, days: d };
}

export function pct(done: number, total: number): number {
  return total === 0 ? 0 : Math.round((done * 100) / total);
}

export function greeting(): string {
  const h = new Date().getHours();
  return h < 12 ? 'Good morning' : h < 17 ? 'Good afternoon' : 'Good evening';
}

export const clamp = (n: number, lo: number, hi: number) => Math.min(hi, Math.max(lo, n));

export const inr = (n: number) => '₹' + Math.round(n).toLocaleString('en-IN');
export function fmtDay(s: string | null | undefined): string {
  if (!s) return '';
  return parseDay(s).toLocaleDateString('en-IN', { weekday: 'short', day: 'numeric', month: 'short' });
}
export function tripDays(start: string, end: string): string[] {
  const out: string[] = [];
  const d = parseDay(start);
  const last = parseDay(end);
  for (let i = 0; i < 60 && d <= last; i++) { out.push(todayStr(d)); d.setDate(d.getDate() + 1); }
  return out;
}
