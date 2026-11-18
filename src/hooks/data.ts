import { useSyncExternalStore } from 'react';
import { useLiveQuery } from 'dexie-react-hooks';
import { db } from '../db/local';
import { getUid, onUidChange } from '../lib/session';
import { getSyncState, onSyncState, type SyncState } from '../db/sync';
import type { Category, Item, Preference, Template, TemplateItem, Trip } from '../types';

export function useUid(): string {
  return useSyncExternalStore(onUidChange, getUid);
}

export function useSyncStatus(): SyncState {
  return useSyncExternalStore((cb) => onSyncState(cb), getSyncState);
}

export function useTrips(): Trip[] | undefined {
  const uid = useUid();
  return useLiveQuery(async () =>
    (await db.trips.toArray()).filter((t) => !t.deleted && t.user_id === uid).sort((a, b) => a.start_date.localeCompare(b.start_date)),
  [uid]);
}

export function useTrip(id: string | undefined): Trip | null | undefined {
  return useLiveQuery(async () => {
    if (!id) return null;
    const t = await db.trips.get(id);
    return t && !t.deleted ? t : null;
  }, [id]);
}

export function useItems(tripId: string | undefined): Item[] | undefined {
  return useLiveQuery(async () => {
    if (!tripId) return [];
    return (await db.items.where('trip_id').equals(tripId).toArray())
      .filter((i) => !i.deleted)
      .sort((a, b) => a.sort_order - b.sort_order || a.created_at.localeCompare(b.created_at));
  }, [tripId]);
}

/** Item counts for every trip, for dashboard cards. */
export function useAllItems(): Item[] | undefined {
  const uid = useUid();
  return useLiveQuery(async () => (await db.items.toArray()).filter((i) => !i.deleted && i.user_id === uid), [uid]);
}

export function usePreferences(): Preference[] | undefined {
  const uid = useUid();
  return useLiveQuery(async () =>
    (await db.preferences.toArray()).filter((p) => !p.deleted && p.user_id === uid).sort((a, b) => b.created_at.localeCompare(a.created_at)),
  [uid]);
}

export function useCategories(): Category[] | undefined {
  const uid = useUid();
  return useLiveQuery(async () =>
    (await db.categories.toArray()).filter((c) => !c.deleted && c.user_id === uid).sort((a, b) => a.sort_order - b.sort_order),
  [uid]);
}

export function useTemplates(): Template[] | undefined {
  const uid = useUid();
  return useLiveQuery(async () =>
    (await db.templates.toArray()).filter((t) => !t.deleted && t.user_id === uid).sort((a, b) => b.created_at.localeCompare(a.created_at)),
  [uid]);
}

export function useTemplate(id: string | undefined): Template | null | undefined {
  return useLiveQuery(async () => {
    if (!id) return null;
    const t = await db.templates.get(id);
    return t && !t.deleted ? t : null;
  }, [id]);
}

export function useTemplateItems(templateId: string | undefined): TemplateItem[] | undefined {
  return useLiveQuery(async () => {
    if (!templateId) return [];
    return (await db.templateItems.where('template_id').equals(templateId).toArray()).filter((i) => !i.deleted);
  }, [templateId]);
}

export function useDisplayName(): [string, (n: string) => void] {
  const get = () => localStorage.getItem('voyago.name') ?? '';
  const name = useSyncExternalStore((cb) => { window.addEventListener('voyago-name', cb); return () => window.removeEventListener('voyago-name', cb); }, get);
  return [name, (n: string) => { localStorage.setItem('voyago.name', n.trim()); window.dispatchEvent(new Event('voyago-name')); }];
}

import type { Booking, Expense, ItineraryItem, JournalEntry, TripDocument } from '../types';

function useTripRows<T extends { deleted: boolean }>(table: 'documents' | 'itinerary' | 'bookings' | 'expenses' | 'journal', tripId: string | undefined): T[] | undefined {
  return useLiveQuery(async () => {
    if (!tripId) return [];
    return ((await db.table(table).where('trip_id').equals(tripId).toArray()) as T[]).filter((r) => !r.deleted);
  }, [tripId, table]);
}
export const useDocuments = (id?: string) => useTripRows<TripDocument>('documents', id);
export const useItinerary = (id?: string) => useTripRows<ItineraryItem>('itinerary', id);
export const useBookings = (id?: string) => useTripRows<Booking>('bookings', id);
export const useExpenses = (id?: string) => useTripRows<Expense>('expenses', id);
export const useJournal = (id?: string) => useTripRows<JournalEntry>('journal', id);
