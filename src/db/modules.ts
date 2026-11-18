import { db } from './local';
import { putRow } from './repo';
import { getUid } from '../lib/session';
import { nowIso, uid } from '../lib/util';
import { getSupabase } from '../lib/supabase';
import type { Booking, Expense, ItineraryItem, JournalEntry, SyncTable, TripDocument } from '../types';

function base() {
  const t = nowIso();
  return { id: uid(), user_id: getUid(), created_at: t, updated_at: t, deleted: false };
}

type Tbl = 'documents' | 'itinerary' | 'bookings' | 'expenses' | 'journal';

async function patch<T extends { id: string; user_id: string }>(table: Tbl, id: string, p: Partial<T>) {
  const cur = (await db.table(table).get(id)) as T | undefined;
  if (cur) await putRow(table as SyncTable, { ...cur, ...p, id: cur.id, user_id: cur.user_id } as never);
}
async function softDelete(table: Tbl, id: string) {
  const cur = await db.table(table).get(id);
  if (cur && !cur.deleted) await putRow(table as SyncTable, { ...cur, deleted: true });
}
async function restore(table: Tbl, id: string) {
  const cur = await db.table(table).get(id);
  if (cur && cur.deleted) await putRow(table as SyncTable, { ...cur, deleted: false });
}
export const removeRow = softDelete;
export const restoreRow = restore;

/* ---------------- itinerary ---------------- */
export type ItineraryInput = Pick<ItineraryItem, 'trip_id' | 'kind' | 'title'> & Partial<Pick<ItineraryItem, 'day_date' | 'start_time' | 'location' | 'notes' | 'tag'>>;
export async function addItinerary(i: ItineraryInput): Promise<ItineraryItem> {
  const same = await db.itinerary.where('trip_id').equals(i.trip_id).toArray();
  const sort = same.reduce((m, x) => Math.max(m, x.sort_order), 0) + 1;
  return putRow('itinerary', {
    ...base(), trip_id: i.trip_id, kind: i.kind, title: i.title.trim(), day_date: i.day_date ?? null, start_time: i.start_time || null,
    location: i.location?.trim() ?? '', notes: i.notes?.trim() ?? '', tag: i.tag ?? '', done: false, sort_order: sort
  } as ItineraryItem);
}
export const updateItinerary = (id: string, p: Partial<ItineraryItem>) => patch<ItineraryItem>('itinerary', id, p);

/* ---------------- bookings ---------------- */
export type BookingInput = Pick<Booking, 'trip_id' | 'kind' | 'title'> & Partial<Omit<Booking, 'id' | 'user_id' | 'created_at' | 'updated_at' | 'deleted' | 'trip_id' | 'kind' | 'title'>>;
export async function addBooking(b: BookingInput): Promise<Booking> {
  return putRow('bookings', {
    ...base(), trip_id: b.trip_id, kind: b.kind, title: b.title.trim(), provider: b.provider?.trim() ?? '', reference: b.reference?.trim() ?? '',
    start_date: b.start_date || null, end_date: b.end_date || null, amount: b.amount ?? null, status: b.status ?? 'confirmed', notes: b.notes?.trim() ?? ''
  } as Booking);
}
export const updateBooking = (id: string, p: Partial<Booking>) => patch<Booking>('bookings', id, p);

/* ---------------- expenses ---------------- */
export async function addExpense(e: Pick<Expense, 'trip_id' | 'category' | 'amount'> & Partial<Pick<Expense, 'note' | 'spent_on' | 'paid_by'>>): Promise<Expense> {
  return putRow('expenses', { ...base(), trip_id: e.trip_id, category: e.category, amount: e.amount, note: e.note?.trim() ?? '', spent_on: e.spent_on || null, paid_by: e.paid_by?.trim() ?? '' } as Expense);
}
export const updateExpense = (id: string, p: Partial<Expense>) => patch<Expense>('expenses', id, p);

/* ---------------- journal ---------------- */
export async function addJournal(j: Pick<JournalEntry, 'trip_id'> & Partial<Pick<JournalEntry, 'entry_date' | 'place' | 'body' | 'photo'>>): Promise<JournalEntry> {
  return putRow('journal', { ...base(), trip_id: j.trip_id, entry_date: j.entry_date || null, place: j.place?.trim() ?? '', body: j.body?.trim() ?? '', photo: j.photo ?? null } as JournalEntry);
}
export const updateJournal = (id: string, p: Partial<JournalEntry>) => patch<JournalEntry>('journal', id, p);

/* ---------------- documents (metadata syncs; file goes to private Storage) ---------------- */
const MAX_FILE = 15 * 1024 * 1024;

export async function addDocument(d: { trip_id: string; kind: string; title: string; notes?: string; file?: File | null }): Promise<TripDocument> {
  if (d.file && d.file.size > MAX_FILE) throw new Error('File is larger than 15 MB');
  const doc = await putRow('documents', {
    ...base(), trip_id: d.trip_id, kind: d.kind, title: d.title.trim(), notes: d.notes?.trim() ?? '',
    file_name: d.file?.name ?? null, mime: d.file?.type || null, size_bytes: d.file?.size ?? null, storage_path: null
  } as TripDocument);
  if (d.file) await db.docFiles.put({ id: doc.id, blob: d.file });
  void uploadPendingDocuments();
  return doc;
}
export const updateDocument = (id: string, p: Partial<TripDocument>) => patch<TripDocument>('documents', id, p);

let uploading = false;
/** Uploads locally stored files that are not in Storage yet. Safe to call any time; does nothing offline or signed out. */
export async function uploadPendingDocuments(): Promise<void> {
  const client = getSupabase();
  if (!client || uploading || !navigator.onLine || getUid() === 'local') return;
  uploading = true;
  try {
    const docs = (await db.documents.toArray()).filter((d) => !d.deleted && d.file_name && !d.storage_path && d.user_id === getUid());
    for (const d of docs) {
      const f = await db.docFiles.get(d.id);
      if (!f) continue;
      const path = `${d.user_id}/${d.trip_id}/${d.id}-${d.file_name!.replace(/[^\w.\-]+/g, '_')}`;
      const { error } = await client.storage.from('trip-documents').upload(path, f.blob, { upsert: true, contentType: d.mime ?? undefined });
      if (!error) await updateDocument(d.id, { storage_path: path });
    }
  } finally {
    uploading = false;
  }
}

/** A URL to open the file: the local copy if this device has it, otherwise a short-lived signed link. */
export async function documentUrl(d: TripDocument): Promise<string | null> {
  const f = await db.docFiles.get(d.id);
  if (f) return URL.createObjectURL(f.blob);
  if (!d.storage_path) return null;
  const { data, error } = (await getSupabase()?.storage.from('trip-documents').createSignedUrl(d.storage_path, 300)) ?? { data: null, error: new Error('offline') };
  return error || !data ? null : data.signedUrl;
}
