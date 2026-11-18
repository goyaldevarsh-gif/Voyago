import type { WeatherSummary } from '../types';
import { daysBetween, todayStr } from './util';

/** Open-Meteo needs no API key. Beyond 16 days it falls back to the same dates last year. */
export async function fetchWeather(place: string, start: string, end: string): Promise<WeatherSummary | null> {
  try {
    const g = await fetch(`https://geocoding-api.open-meteo.com/v1/search?name=${encodeURIComponent(place)}&count=1`);
    const gj = await g.json();
    const loc = gj.results?.[0];
    if (!loc) return null;
    const soon = daysBetween(todayStr(), start) <= 14 && daysBetween(todayStr(), start) >= 0;
    let s = start, e = end, host = 'api.open-meteo.com/v1/forecast', basis: WeatherSummary['basis'] = 'forecast';
    if (!soon) {
      const shift = (d: string) => { const [y, m, dd] = d.split('-').map(Number); return `${y - 1}-${String(m).padStart(2, '0')}-${String(dd).padStart(2, '0')}`; };
      const thisYear = Number(start.slice(0, 4));
      const cur = new Date().getFullYear();
      const yrs = Math.max(1, thisYear - cur + 1);
      const back = (d: string) => { let x = d; for (let i = 0; i < yrs; i++) x = shift(x); return x; };
      s = back(start); e = back(end); host = 'archive-api.open-meteo.com/v1/archive'; basis = 'last-year';
    }
    const url = `https://${host}?latitude=${loc.latitude}&longitude=${loc.longitude}&start_date=${s}&end_date=${e}` +
      `&daily=temperature_2m_max,temperature_2m_min,precipitation_sum&timezone=auto`;
    const r = await fetch(url);
    const j = await r.json();
    const mx: number[] = (j.daily?.temperature_2m_max ?? []).filter((n: unknown) => typeof n === 'number');
    const mn: number[] = (j.daily?.temperature_2m_min ?? []).filter((n: unknown) => typeof n === 'number');
    const pr: number[] = (j.daily?.precipitation_sum ?? []).map((n: unknown) => (typeof n === 'number' ? n : 0));
    if (!mx.length || !mn.length) return null;
    const avg = (a: number[]) => a.reduce((x, y) => x + y, 0) / a.length;
    const rainyDays = pr.filter((p) => p >= 1).length;
    return {
      max_c: Math.round(Math.max(...mx)), min_c: Math.round(Math.min(...mn)),
      avg_c: Math.round((avg(mx) + avg(mn)) / 2),
      rain_pct: Math.round((rainyDays * 100) / Math.max(1, pr.length)),
      basis, fetched_at: new Date().toISOString()
    };
  } catch {
    return null;
  }
}
