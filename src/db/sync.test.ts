import 'fake-indexeddb/auto';
import { beforeEach, describe, expect, it } from 'vitest';
import { db } from './local';
import * as repo from './repo';
import { SyncEngine } from './sync';

// ---- minimal in-memory stand-in for the Supabase client ----
type Row = Record<string, any>;
function fakeClient(server: Record<string, Row[]>, opts: { failUniqueItems?: boolean } = {}) {
  const builder = (table: string) => {
    server[table] ||= [];
    return {
      upsert: async (rows: Row | Row[]) => {
        for (const r of ([] as Row[]).concat(rows)) {
          if (opts.failUniqueItems && table === 'packing_items')
            return { error: { code: '23505', message: 'duplicate key' } };
          const i = server[table].findIndex((x) => x.id === r.id);
          if (i >= 0) { if (server[table][i].updated_at > r.updated_at) continue; server[table][i] = { ...r }; }
          else server[table].push({ ...r });
        }
        return { error: null };
      },
      select: () => {
        let since = '';
        const q: any = {
          gte: (_c: string, v: string) => { since = v; return q; },
          order: () => q,
          limit: async () => ({ data: server[table].filter((r) => r.updated_at >= since).sort((a, b) => a.updated_at.localeCompare(b.updated_at)), error: null })
        };
        return q;
      }
    };
  };
  const ch: any = { on: () => ch, subscribe: () => ch };
  return { from: builder, channel: () => ch, removeChannel: async () => undefined } as any;
}

(globalThis as any).window = { addEventListener() {}, removeEventListener() {} };
Object.defineProperty(globalThis, 'navigator', { value: { onLine: true }, configurable: true });

const mkTrip = () => repo.createTrip({
  name: 'Goa', destination: 'Goa', start_date: '2026-12-27', end_date: '2027-01-01', travellers_count: 2,
  traveller_type: 'couple', trip_type: 'vacation', travel_mode: 'flight', accommodation: '', notes: '', international: false
});

beforeEach(async () => { await db.delete(); await db.open(); });

describe('sync engine', () => {
  it('pushes queued writes parents-first and clears the outbox', async () => {
    const server: Record<string, Row[]> = {};
    const t = await mkTrip();
    await repo.addItem(t.id, { name: 'Charger', category: 'Electronics' });
    const e = new SyncEngine(fakeClient(server), 'u1');
    await e.push();
    expect(server.trips).toHaveLength(1);
    expect(server.packing_items).toHaveLength(1);
    expect(server.packing_items[0].user_id).toBe('u1');
    expect(await db.outbox.count()).toBe(0);
  });

  it('pulls a change made elsewhere (e.g. by the AI) into the local store', async () => {
    const server: Record<string, Row[]> = {};
    const t = await mkTrip();
    const e = new SyncEngine(fakeClient(server), 'u1');
    await e.push();
    // the server-side AI adds an item
    server.packing_items = [{ id: 'ai-1', user_id: 'u1', trip_id: t.id, name: 'Sunscreen', category: 'Toiletries', quantity: 1,
      packed: false, priority: 'essential', notes: '', bag: null, sort_order: 1, source: 'ai', deleted: false,
      created_at: new Date().toISOString(), updated_at: '2999-01-01T00:00:00.000000+00:00' }];
    await e.pull();
    const got = await db.items.get('ai-1');
    expect(got?.name).toBe('Sunscreen');
    expect(got?.updated_at).toBe('2999-01-01T00:00:00.000Z'); // normalised
  });

  it('a pending local change is never overwritten by an older server row', async () => {
    const server: Record<string, Row[]> = {};
    const t = await mkTrip();
    const { item } = await repo.addItem(t.id, { name: 'Charger', category: 'Electronics' });
    const e = new SyncEngine(fakeClient(server), 'u1');
    await e.push();
    await repo.setPacked(item.id, true); // offline edit, still in outbox
    server.packing_items[0].packed = false;
    server.packing_items[0].updated_at = '2000-01-01T00:00:00.000Z';
    await e.pull();
    expect((await db.items.get(item.id))!.packed).toBe(true);
  });

  it('a newer server row replaces an older local row (packed on another device)', async () => {
    const server: Record<string, Row[]> = {};
    const t = await mkTrip();
    const { item } = await repo.addItem(t.id, { name: 'Charger', category: 'Electronics' });
    const e = new SyncEngine(fakeClient(server), 'u1');
    await e.push();
    server.packing_items[0] = { ...server.packing_items[0], packed: true, updated_at: '2999-01-01T00:00:00.000Z' };
    await e.pull();
    expect((await db.items.get(item.id))!.packed).toBe(true);
  });

  it('a duplicate created on two devices resolves to the server copy', async () => {
    const server: Record<string, Row[]> = {};
    const t = await mkTrip();
    const { item } = await repo.addItem(t.id, { name: 'Charger', category: 'Electronics' });
    const e = new SyncEngine(fakeClient(server, { failUniqueItems: true }), 'u1');
    await e.push();
    expect((await db.items.get(item.id))!.deleted).toBe(true);
    expect(await db.outbox.where('table').equals('items').count()).toBe(0);
  });
});
