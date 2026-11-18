import { normName } from './util';
import type { Preference } from '../types';

export interface PrefContext { type: string; nights: number }

const tokens = (s: string) => normName(s).split(' ').filter(Boolean).map((t) => t.replace(/(s|es)$/, ''));

/** "formal shoes" matches "Formal shoes"; "t-shirt" matches "T-shirts"; "dryer" alone does not match "hair dryer" rules. */
export function nameMatches(itemName: string, prefItem: string): boolean {
  const a = tokens(itemName);
  const b = tokens(prefItem);
  if (b.length === 0) return false;
  return b.every((t) => a.includes(t));
}

/** A preference applies only to the trip types and lengths it was saved for. */
export function prefApplies(p: Preference, ctx: PrefContext): boolean {
  if (!p.active || p.deleted) return false;
  if (p.trip_types.length > 0 && !p.trip_types.includes(ctx.type)) return false;
  if (p.min_nights !== null && ctx.nights < p.min_nights) return false;
  if (p.max_nights !== null && ctx.nights > p.max_nights) return false;
  return true;
}

export function describeScope(p: Preference): string {
  const parts: string[] = [];
  parts.push(p.trip_types.length ? `${p.trip_types.join(', ')} trips` : 'all trips');
  if (p.min_nights !== null || p.max_nights !== null) {
    if (p.max_nights !== null && p.min_nights === null) parts.push(`up to ${p.max_nights} nights`);
    else if (p.min_nights !== null && p.max_nights === null) parts.push(`${p.min_nights}+ nights`);
    else parts.push(`${p.min_nights}–${p.max_nights} nights`);
  }
  return parts.join(', ');
}
