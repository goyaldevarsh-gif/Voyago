import { CATALOG, buildCtx, findCatalog, type Ctx } from '../data/catalog';
import { nameMatches, prefApplies } from './prefs';
import type { Preference, Priority, Trip } from '../types';

export interface GenItem {
  name: string;
  category: string;
  quantity: number;
  priority: Priority;
  bag: string | null;
  reason: string;
  /** statements of the saved preferences that changed this suggestion */
  influencedBy: string[];
}

export interface Influence {
  prefId: string;
  statement: string;
  action: 'left out' | 'added' | 'quantity set';
  item: string;
}

export interface Generated { items: GenItem[]; influences: Influence[]; ctx: Ctx }

export function generate(ctx: Ctx, prefs: Preference[] = []): Generated {
  let items: GenItem[] = [];
  for (const c of CATALOG) {
    const r = c.rule(ctx);
    if (!r) continue;
    items.push({ name: c.name, category: c.category, quantity: r.qty, priority: c.priority, bag: c.bag, reason: r.why, influencedBy: [] });
  }

  const influences: Influence[] = [];
  const active = prefs.filter((p) => prefApplies(p, { type: ctx.type, nights: ctx.nights }));

  for (const p of active) {
    if (p.effect === 'exclude') {
      const keep: GenItem[] = [];
      for (const i of items) {
        if (nameMatches(i.name, p.item_name)) influences.push({ prefId: p.id, statement: p.statement, action: 'left out', item: i.name });
        else keep.push(i);
      }
      items = keep;
    } else if (p.effect === 'include' || p.effect === 'quantity') {
      const hit = items.find((i) => nameMatches(i.name, p.item_name));
      if (hit) {
        if (p.effect === 'quantity' && p.quantity) {
          hit.quantity = p.quantity;
          hit.influencedBy.push(p.statement);
          influences.push({ prefId: p.id, statement: p.statement, action: 'quantity set', item: hit.name });
        } else if (p.effect === 'include') {
          if (p.kind === 'permanent' || p.kind === 'frequent') hit.priority = 'essential';
          hit.influencedBy.push(p.statement);
        }
      } else {
        const cat = findCatalog(p.item_name);
        items.push({
          name: cat?.name ?? capitalise(p.item_name),
          category: cat?.category ?? p.category ?? 'Miscellaneous',
          quantity: p.quantity ?? 1,
          priority: p.kind === 'permanent' || p.kind === 'frequent' ? 'essential' : 'optional',
          bag: cat?.bag ?? null,
          reason: 'Your saved preference',
          influencedBy: [p.statement]
        });
        influences.push({ prefId: p.id, statement: p.statement, action: 'added', item: cat?.name ?? capitalise(p.item_name) });
      }
    } else if (p.effect === 'note') {
      const hit = items.find((i) => nameMatches(i.name, p.item_name));
      if (hit) hit.influencedBy.push(p.statement);
    }
  }
  return { items, influences, ctx };
}

export function generateForTrip(trip: Trip, nights: number, prefs: Preference[] = []): Generated {
  return generate(
    buildCtx({
      nights, type: trip.trip_type, mode: trip.travel_mode, travellers: trip.travellers_count,
      traveller_type: trip.traveller_type, destination: trip.destination, weather: trip.weather,
      international: trip.international, accommodation: trip.accommodation
    }),
    prefs
  );
}

const capitalise = (s: string) => s.trim().charAt(0).toUpperCase() + s.trim().slice(1);
