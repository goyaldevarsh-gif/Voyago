import 'fake-indexeddb/auto';
import { beforeEach, describe, expect, it } from 'vitest';
import { db } from './local';
import * as repo from './repo';
import { generate } from '../lib/generator';
import { buildCtx } from '../data/catalog';
import { addPreference } from './repo';

const trip = () => repo.createTrip({
  name: 'Goa', destination: 'Goa', start_date: '2026-12-27', end_date: '2027-01-01', travellers_count: 2,
  traveller_type: 'couple', trip_type: 'vacation', travel_mode: 'flight', accommodation: 'Hotel', notes: '', international: false
});

beforeEach(async () => { await db.delete(); await db.open(); });

describe('repo', () => {
  it('merges duplicate items instead of creating two rows', async () => {
    const t = await trip();
    await repo.addItem(t.id, { name: 'T-shirts', category: 'Clothing', quantity: 3 });
    const r = await repo.addItem(t.id, { name: 'T-shirt', category: 'Clothing', quantity: 2 });
    expect(r.merged).toBe(true);
    const items = (await db.items.toArray()).filter((i) => !i.deleted);
    expect(items).toHaveLength(1);
    expect(items[0].quantity).toBe(5);
  });
  it('keeps quantity-based entries as one row', async () => {
    const t = await trip();
    await repo.addItem(t.id, { name: 'T-shirts', category: 'Clothing', quantity: 5 });
    expect((await db.items.toArray())).toHaveLength(1);
  });
  it('queues every write in the outbox once per row', async () => {
    const t = await trip();
    const { item } = await repo.addItem(t.id, { name: 'Charger', category: 'Electronics' });
    await repo.setPacked(item.id, true);
    await repo.setPacked(item.id, false);
    const keys = (await db.outbox.toArray()).map((o) => o.key);
    expect(keys.filter((k) => k === `items:${item.id}`)).toHaveLength(1);
  });
  it('soft-deletes a trip with its items and can restore it', async () => {
    const t = await trip();
    await repo.addItem(t.id, { name: 'Charger', category: 'Electronics' });
    await repo.deleteTrip(t.id);
    expect((await db.items.toArray()).every((i) => i.deleted)).toBe(true);
    await repo.restoreTrip(t.id);
    expect((await db.items.toArray()).every((i) => !i.deleted)).toBe(true);
  });
  it('reorders within a category', async () => {
    const t = await trip();
    const a = (await repo.addItem(t.id, { name: 'A', category: 'Clothing' })).item;
    const b = (await repo.addItem(t.id, { name: 'B', category: 'Clothing' })).item;
    await repo.moveItem(b.id, -1);
    const order = (await db.items.toArray()).sort((x, y) => x.sort_order - y.sort_order).map((i) => i.name);
    expect(order).toEqual(['B', 'A']);
    expect(a.id).not.toBe(b.id);
  });
});

describe('generator and preferences', () => {
  const ctx = (type: 'vacation' | 'wedding', nights: number) =>
    buildCtx({ nights, type, mode: 'flight', travellers: 2 });

  it('scales clothing with trip length and caps it for long trips', () => {
    const short = generate(ctx('vacation', 2)).items.find((i) => i.name === 'Innerwear')!;
    const long = generate(ctx('vacation', 20)).items.find((i) => i.name === 'Innerwear')!;
    expect(short.quantity).toBe(4);
    expect(long.quantity).toBeLessThanOrEqual(9);
    expect(long.quantity).toBeGreaterThan(short.quantity);
  });
  it('gives winter and beach trips different lists', () => {
    const beach = generate(buildCtx({ nights: 5, type: 'vacation', mode: 'flight', travellers: 2, tags: ['beach'] })).items.map((i) => i.name);
    const winter = generate(buildCtx({ nights: 5, type: 'vacation', mode: 'road', travellers: 2, tags: ['winter'] })).items.map((i) => i.name);
    expect(beach).toContain('Swimwear');
    expect(beach).not.toContain('Jackets');
    expect(winter).toContain('Jackets');
    expect(winter).not.toContain('Swimwear');
  });
  it('a vacation-only preference does not exclude formal shoes on a wedding trip', async () => {
    await addPreference({
      kind: 'context', statement: "I don't carry formal shoes on normal vacations", item_name: 'formal shoes',
      category: 'Footwear', effect: 'exclude', quantity: null, trip_types: ['vacation'], min_nights: null, max_nights: null, source: 'chat'
    });
    const prefs = await db.preferences.toArray();
    const vac = generate(ctx('vacation', 4), prefs);
    const wed = generate(ctx('wedding', 4), prefs);
    expect(vac.items.map((i) => i.name)).not.toContain('Formal shoes');
    expect(wed.items.map((i) => i.name)).toContain('Formal shoes');
    expect(wed.influences).toHaveLength(0);
  });
  it('shows which preference influenced a suggestion', async () => {
    await addPreference({
      kind: 'permanent', statement: 'I always carry my Apple Watch charger', item_name: 'smartwatch charger',
      category: 'Electronics', effect: 'include', quantity: 1, trip_types: [], min_nights: null, max_nights: null, source: 'chat'
    });
    const g = generate(ctx('vacation', 4), await db.preferences.toArray());
    const w = g.items.find((i) => i.name === 'Smartwatch charger')!;
    expect(w.priority).toBe('essential');
    expect(w.influencedBy[0]).toContain('Apple Watch');
  });
  it('does not save the same preference twice', async () => {
    const p = { kind: 'avoid' as const, statement: 'no hair dryer', item_name: 'hair dryer', category: null, effect: 'exclude' as const, quantity: null, trip_types: [], min_nights: null, max_nights: null, source: 'chat' as const };
    await addPreference(p); await addPreference(p);
    expect((await db.preferences.toArray()).filter((x) => !x.deleted)).toHaveLength(1);
  });
});
