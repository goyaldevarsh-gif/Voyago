import { describe, expect, it } from 'vitest';
import { nextAction, snapshot, urgencyFor } from './nextAction';
import type { Item, Trip } from '../types';

const trip = (start: string, end: string): Trip => ({
  id: 't1', user_id: 'u', created_at: '', updated_at: '', deleted: false, name: 'Test', destination: '', start_date: start, end_date: end,
  travellers_count: 1, traveller_type: 'solo', trip_type: 'other', travel_mode: 'road', accommodation: '', notes: '', cover_image: null,
  weather: null, status: 'planning', international: false
});
let n = 0;
const item = (o: Partial<Item>): Item => ({
  id: `i${++n}`, user_id: 'u', created_at: `2026-01-${String(n % 28 + 1).padStart(2, '0')}`, updated_at: '', deleted: false, trip_id: 't1',
  name: 'Thing', category: 'Misc', quantity: 1, packed: false, priority: 'optional', notes: '', bag: null, sort_order: n, source: 'manual', pack_when: 'any', ...o
});
const T = trip('2026-11-19', '2026-11-22');

describe('nextAction', () => {
  it('empty list prompts to generate', () => {
    const a = nextAction(T, [], '2026-11-10');
    expect(a.state).toBe('empty');
    expect(a.cta.to).toContain('generate=1');
  });
  it('0% progress with essentials left, many days out, is calm', () => {
    const a = nextAction(T, [item({ priority: 'essential' }), item({})], '2026-11-10');
    expect(a.state).toBe('upcoming');
    expect(a.urgency).toBe('calm');
    expect(a.headline).toBe('1 essential left to pack');
    expect(a.sub).toContain('0%');
    expect(a.chip).toBe('In 9 days');
  });
  it('becomes danger the day before when essentials are left', () => {
    const a = nextAction(T, [item({ priority: 'essential' })], '2026-11-18');
    expect(a.urgency).toBe('danger');
    expect(a.chip).toBe('Tomorrow');
  });
  it('partially packed counts only unpacked essentials', () => {
    const items = [item({ priority: 'essential', packed: true }), item({ priority: 'essential' }), item({ packed: true }), item({})];
    const s = snapshot(T, items, '2026-11-10');
    expect(s.pct).toBe(50);
    expect(s.essentialsLeft).toHaveLength(1);
    expect(nextAction(T, items, '2026-11-10').headline).toBe('1 essential left to pack');
  });
  it('essentials done shows continue packing, and a travel day link when morning items remain', () => {
    const a = nextAction(T, [item({ priority: 'essential', packed: true }), item({ name: 'Phone charger', pack_when: 'last_minute' })], '2026-11-10');
    expect(a.headline).toBe('Essentials are done');
    expect(a.secondary?.label).toContain('Travel day');
  });
  it('fully packed goes to final review', () => {
    const a = nextAction(T, [item({ packed: true }), item({ packed: true })], '2026-11-18');
    expect(a.state).toBe('all-packed');
    expect(a.urgency).toBe('done');
    expect(a.cta.label).toBe('Final review');
  });
  it('travel day with essentials left is urgent', () => {
    const a = nextAction(T, [item({ priority: 'essential' }), item({ priority: 'essential' })], '2026-11-19');
    expect(a.state).toBe('today');
    expect(a.urgency).toBe('danger');
    expect(a.headline).toBe('2 essentials still not packed');
  });
  it('trip in progress and ended trips', () => {
    expect(nextAction(T, [item({})], '2026-11-20').headline).toBe('Day 2 of 4');
    const ended = nextAction(T, [item({}), item({ packed: true })], '2026-11-25');
    expect(ended.state).toBe('ended');
    expect(ended.sub).toContain('1 item never ticked');
  });
  it('ignores items from other trips and deleted items', () => {
    const items = [item({ trip_id: 'other', priority: 'essential' }), item({ deleted: true, priority: 'essential' })];
    expect(nextAction(T, items, '2026-11-10').state).toBe('empty');
  });
  it('focus is the first pending essential from real data and moves on when it is packed', () => {
    const e1 = item({ name: 'Aadhaar', priority: 'essential', sort_order: 1 });
    const e2 = item({ name: 'Charger', priority: 'essential', sort_order: 2 });
    expect(nextAction(T, [e2, e1], '2026-11-10').focus?.name).toBe('Aadhaar');
    expect(nextAction(T, [{ ...e1, packed: true }, e2], '2026-11-10').focus?.name).toBe('Charger');
    expect(nextAction(T, [{ ...e1, packed: true }, { ...e2, packed: true }, item({})], '2026-11-10').focus).toBeNull();
    expect(nextAction(T, [], '2026-11-10').focus).toBeNull();
  });
  it('urgency helper', () => {
    expect(urgencyFor(5, 0, 'essentials')).toBe('done');
    expect(urgencyFor(3, 2, 'essentials')).toBe('warn');
    expect(urgencyFor(1, 2, 'travel')).toBe('warn');
    expect(urgencyFor(0, 2, 'travel')).toBe('danger');
  });
});
