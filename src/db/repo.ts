import { db } from './local';
import { getUid } from '../lib/session';
import { nowIso, uid, normName } from '../lib/util';
import type {
  Base, Category, Item, ItemSource, Preference, Priority, SyncTable, Template,
  TemplateItem, Traveller, Trip
} from '../types';

type Row = Base | { id: string; user_id: string; updated_at: string; deleted: boolean; created_at: string };

let outboxListener: (() => void) | null = null;
export function onOutboxChange(f: () => void) { outboxListener = f; }

/** Write a row locally and queue it for the backend, atomically. */
export async function putRow<T extends Row>(table: SyncTable, row: T): Promise<T> {
  const next = { ...row, updated_at: nowIso() } as T;
  await db.transaction('rw', [db.table(table), db.outbox], async () => {
    await db.table(table).put(next);
    await db.outbox.put({
      key: `${table}:${next.id}`, table, id: next.id, row: next, queued_at: nowIso(), attempts: 0
    });
  });
  outboxListener?.();
  return next;
}

function base(): Pick<Base, 'id' | 'user_id' | 'created_at' | 'updated_at' | 'deleted'> {
  const t = nowIso();
  return { id: uid(), user_id: getUid(), created_at: t, updated_at: t, deleted: false };
}

/* ---------------- trips ---------------- */

export type TripInput = Omit<Trip, keyof Base | 'status' | 'cover_image' | 'weather'> &
  Partial<Pick<Trip, 'status' | 'cover_image' | 'weather'>>;

export async function createTrip(input: TripInput): Promise<Trip> {
  const trip: Trip = {
    ...base(), status: 'planning', cover_image: null, weather: null, ...input
  };
  return putRow('trips', trip);
}

export async function updateTrip(id: string, patch: Partial<Trip>): Promise<Trip | undefined> {
  const cur = await db.trips.get(id);
  if (!cur || cur.deleted) return undefined;
  return putRow('trips', { ...cur, ...patch, id: cur.id, user_id: cur.user_id });
}

export async function deleteTrip(id: string): Promise<void> {
  const cur = await db.trips.get(id);
  if (!cur) return;
  const items = await db.items.where('trip_id').equals(id).toArray();
  const trav = await db.travellers.where('trip_id').equals(id).toArray();
  for (const it of items) if (!it.deleted) await putRow('items', { ...it, deleted: true });
  for (const t of trav) if (!t.deleted) await putRow('travellers', { ...t, deleted: true });
  await putRow('trips', { ...cur, deleted: true });
}

export async function restoreTrip(id: string): Promise<void> {
  const cur = await db.trips.get(id);
  if (!cur) return;
  const items = await db.items.where('trip_id').equals(id).toArray();
  for (const it of items) if (it.deleted) await putRow('items', { ...it, deleted: false });
  await putRow('trips', { ...cur, deleted: false });
}

export async function addTraveller(tripId: string, name: string, kind: Traveller['kind'] = 'adult') {
  return putRow('travellers', { ...base(), trip_id: tripId, name, kind } as Traveller);
}

/* ---------------- items ---------------- */

export interface ItemInput {
  name: string;
  category: string;
  quantity?: number;
  priority?: Priority;
  notes?: string;
  bag?: string | null;
  source?: ItemSource;
  packed?: boolean;
}

async function nextSort(tripId: string, category: string): Promise<number> {
  const same = await db.items.where('trip_id').equals(tripId).filter((i) => !i.deleted && i.category === category).toArray();
  return same.reduce((m, i) => Math.max(m, i.sort_order), 0) + 1;
}

export async function findDuplicate(tripId: string, name: string): Promise<Item | undefined> {
  const n = normName(name);
  const all = await db.items.where('trip_id').equals(tripId).toArray();
  return all.find((i) => !i.deleted && normName(i.name) === n);
}

/**
 * Adds an item, or merges into an existing one with the same name so the list
 * never gets duplicates. mode "add" sums quantities, "keep" leaves the existing one.
 */
export async function addItem(
  tripId: string, input: ItemInput, mode: 'add' | 'keep' | 'set' = 'add'
): Promise<{ item: Item; merged: boolean }> {
  const dup = await findDuplicate(tripId, input.name);
  const qty = Math.max(1, Math.round(input.quantity ?? 1));
  if (dup) {
    const quantity = mode === 'add' ? dup.quantity + qty : mode === 'set' ? qty : dup.quantity;
    const item = await putRow('items', {
      ...dup,
      quantity,
      priority: input.priority === 'essential' ? 'essential' : dup.priority,
      notes: dup.notes || input.notes || '',
      bag: dup.bag ?? input.bag ?? null
    });
    return { item, merged: true };
  }
  const item = await putRow('items', {
    ...base(),
    trip_id: tripId,
    name: input.name.trim(),
    category: input.category,
    quantity: qty,
    packed: input.packed ?? false,
    priority: input.priority ?? 'optional',
    notes: input.notes ?? '',
    bag: input.bag ?? null,
    sort_order: await nextSort(tripId, input.category),
    source: input.source ?? 'manual'
  } as Item);
  return { item, merged: false };
}

export async function addItems(tripId: string, inputs: ItemInput[], mode: 'add' | 'keep' | 'set' = 'keep') {
  let added = 0, merged = 0;
  for (const i of inputs) {
    const r = await addItem(tripId, i, mode);
    if (r.merged) merged++; else added++;
  }
  return { added, merged };
}

export async function updateItem(id: string, patch: Partial<Item>): Promise<Item | undefined> {
  const cur = await db.items.get(id);
  if (!cur || cur.deleted) return undefined;
  const next = { ...cur, ...patch, id: cur.id, trip_id: cur.trip_id, user_id: cur.user_id };
  if (patch.quantity !== undefined) next.quantity = Math.max(1, Math.round(patch.quantity));
  return putRow('items', next);
}

export const setPacked = (id: string, packed: boolean) => updateItem(id, { packed });

export async function deleteItem(id: string): Promise<Item | undefined> {
  const cur = await db.items.get(id);
  if (!cur) return undefined;
  return putRow('items', { ...cur, deleted: true });
}

export async function restoreItem(id: string) {
  const cur = await db.items.get(id);
  if (cur) await putRow('items', { ...cur, deleted: false });
}

export async function setManyPacked(ids: string[], packed: boolean) {
  for (const id of ids) await setPacked(id, packed);
}

/** Swap sort_order with the neighbour in the same category. */
export async function moveItem(id: string, dir: -1 | 1) {
  const cur = await db.items.get(id);
  if (!cur) return;
  const sib = (await db.items.where('trip_id').equals(cur.trip_id).filter((i) => !i.deleted && i.category === cur.category).toArray())
    .sort((a, b) => a.sort_order - b.sort_order || a.created_at.localeCompare(b.created_at));
  const idx = sib.findIndex((i) => i.id === id);
  const other = sib[idx + dir];
  if (!other) return;
  // renumber so equal sort_orders can't block a swap
  const order = sib.map((i) => i.id);
  order[idx] = other.id;
  order[idx + dir] = id;
  for (let n = 0; n < order.length; n++) {
    const it = sib.find((i) => i.id === order[n])!;
    if (it.sort_order !== n + 1) await putRow('items', { ...it, sort_order: n + 1 });
  }
}

export async function copyTripItems(fromTripId: string, toTripId: string, resetPacked = true) {
  const src = (await db.items.where('trip_id').equals(fromTripId).toArray()).filter((i) => !i.deleted);
  return addItems(toTripId, src.map((i) => ({
    name: i.name, category: i.category, quantity: i.quantity, priority: i.priority,
    notes: i.notes, bag: i.bag, source: 'template' as const, packed: resetPacked ? false : i.packed
  })), 'keep');
}

/* ---------------- categories ---------------- */

export async function addCategory(name: string, icon = 'Package'): Promise<Category> {
  const existing = await db.categories.toArray();
  const dup = existing.find((c) => !c.deleted && normName(c.name) === normName(name));
  if (dup) return dup;
  return putRow('categories', { ...base(), name: name.trim(), icon, sort_order: existing.length + 100 } as Category);
}

export async function deleteCategory(id: string) {
  const cur = await db.categories.get(id);
  if (cur) await putRow('categories', { ...cur, deleted: true });
}

/* ---------------- templates ---------------- */

export async function createTemplate(input: Pick<Template, 'name' | 'description' | 'trip_type' | 'nights'>) {
  return putRow('templates', { ...base(), ...input } as Template);
}

export async function updateTemplate(id: string, patch: Partial<Template>) {
  const cur = await db.templates.get(id);
  if (cur) await putRow('templates', { ...cur, ...patch, id: cur.id, user_id: cur.user_id });
}

export async function deleteTemplate(id: string) {
  const cur = await db.templates.get(id);
  if (!cur) return;
  const items = await db.templateItems.where('template_id').equals(id).toArray();
  for (const it of items) if (!it.deleted) await putRow('templateItems', { ...it, deleted: true });
  await putRow('templates', { ...cur, deleted: true });
}

export async function addTemplateItem(templateId: string, i: ItemInput) {
  const all = await db.templateItems.where('template_id').equals(templateId).toArray();
  const dup = all.find((t) => !t.deleted && normName(t.name) === normName(i.name));
  if (dup) return putRow('templateItems', { ...dup, quantity: i.quantity ?? dup.quantity });
  return putRow('templateItems', {
    ...base(), template_id: templateId, name: i.name.trim(), category: i.category,
    quantity: Math.max(1, i.quantity ?? 1), priority: i.priority ?? 'optional', notes: i.notes ?? '', bag: i.bag ?? null
  } as TemplateItem);
}

export async function updateTemplateItem(id: string, patch: Partial<TemplateItem>) {
  const cur = await db.templateItems.get(id);
  if (cur) await putRow('templateItems', { ...cur, ...patch, id: cur.id, template_id: cur.template_id, user_id: cur.user_id });
}

export async function deleteTemplateItem(id: string) {
  const cur = await db.templateItems.get(id);
  if (cur) await putRow('templateItems', { ...cur, deleted: true });
}

/** Save a trip's packing list as a reusable personal template. */
export async function templateFromTrip(tripId: string, name: string): Promise<Template> {
  const trip = await db.trips.get(tripId);
  if (!trip) throw new Error('Trip not found');
  const nights = Math.max(0, Math.round((new Date(trip.end_date).getTime() - new Date(trip.start_date).getTime()) / 86400000));
  const tpl = await createTemplate({ name, description: `Saved from ${trip.name}`, trip_type: trip.trip_type, nights });
  const items = (await db.items.where('trip_id').equals(tripId).toArray()).filter((i) => !i.deleted);
  for (const i of items)
    await addTemplateItem(tpl.id, { name: i.name, category: i.category, quantity: i.quantity, priority: i.priority, notes: i.notes, bag: i.bag });
  return tpl;
}

/* ---------------- preferences ---------------- */

export type PrefInput = Omit<Preference, keyof Base | 'active'> & { active?: boolean };

export async function addPreference(input: PrefInput): Promise<Preference> {
  // never store the same statement twice
  const all = await db.preferences.toArray();
  const dup = all.find((p) => !p.deleted && p.effect === input.effect &&
    normName(p.item_name) === normName(input.item_name) &&
    JSON.stringify([...p.trip_types].sort()) === JSON.stringify([...input.trip_types].sort()) &&
    p.min_nights === input.min_nights && p.max_nights === input.max_nights);
  if (dup) return putRow('preferences', { ...dup, ...input, active: true, id: dup.id, user_id: dup.user_id });
  return putRow('preferences', { ...base(), active: true, ...input } as Preference);
}

export async function updatePreference(id: string, patch: Partial<Preference>) {
  const cur = await db.preferences.get(id);
  if (cur) await putRow('preferences', { ...cur, ...patch, id: cur.id, user_id: cur.user_id });
}

export async function deletePreference(id: string) {
  const cur = await db.preferences.get(id);
  if (cur) await putRow('preferences', { ...cur, deleted: true });
}

/* ---------------- stats ---------------- */

export interface Stats { total: number; packed: number; pending: number; essentialPending: Item[]; pct: number }

export function statsOf(items: Item[]): Stats {
  const live = items.filter((i) => !i.deleted);
  const packed = live.filter((i) => i.packed).length;
  return {
    total: live.length,
    packed,
    pending: live.length - packed,
    essentialPending: live.filter((i) => !i.packed && i.priority === 'essential'),
    pct: live.length === 0 ? 0 : Math.round((packed * 100) / live.length)
  };
}

/* ---------------- backup / restore ---------------- */

export async function exportAll(): Promise<string> {
  const data = {
    app: 'voyago', version: 1, exported_at: nowIso(),
    trips: await db.trips.toArray(), travellers: await db.travellers.toArray(),
    items: await db.items.toArray(), categories: await db.categories.toArray(),
    templates: await db.templates.toArray(), templateItems: await db.templateItems.toArray(),
    preferences: await db.preferences.toArray()
  };
  return JSON.stringify(data, null, 2);
}

/** Import a backup or a personal seed. Rows get a fresh owner and are queued for sync. */
export async function importAll(json: string): Promise<number> {
  const d = JSON.parse(json);
  if (d.app !== 'voyago') throw new Error('Not a Voyago backup file');
  const tables: SyncTable[] = ['trips', 'travellers', 'items', 'categories', 'templates', 'templateItems', 'preferences'];
  let n = 0;
  for (const t of tables) {
    for (const r of (d[t] ?? []) as Row[]) {
      await putRow(t, { ...r, user_id: getUid() });
      n++;
    }
  }
  return n;
}

/** Wipe everything on this device (and queue deletions for the backend). */
export async function deleteAllMyData(): Promise<void> {
  const tables: SyncTable[] = ['trips', 'travellers', 'items', 'categories', 'templates', 'templateItems', 'preferences'];
  for (const t of tables) {
    const rows = (await db.table(t).toArray()) as Row[];
    for (const r of rows) if (!r.deleted) await putRow(t, { ...r, deleted: true });
  }
}
