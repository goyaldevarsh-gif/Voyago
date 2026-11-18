import Dexie, { type Table } from 'dexie';
import type {
  ActionLog, Category, ChatMessage, Conversation, Item, OutboxEntry, Preference,
  Template, TemplateItem, Traveller, Trip
} from '../types';

/**
 * Local-first store. The UI only ever reads from here (via liveQuery), so
 * changes made by chat, by realtime sync or by the user all appear instantly.
 * Postgres (Supabase) is the central source of truth; this mirrors it.
 */
export class VoyagoDB extends Dexie {
  trips!: Table<Trip, string>;
  travellers!: Table<Traveller, string>;
  items!: Table<Item, string>;
  categories!: Table<Category, string>;
  templates!: Table<Template, string>;
  templateItems!: Table<TemplateItem, string>;
  preferences!: Table<Preference, string>;
  conversations!: Table<Conversation, string>;
  messages!: Table<ChatMessage, string>;
  actionLogs!: Table<ActionLog, string>;
  outbox!: Table<OutboxEntry, string>;
  meta!: Table<{ key: string; value: unknown }, string>;

  constructor(name = 'voyago') {
    super(name);
    this.version(1).stores({
      trips: 'id, user_id, start_date, updated_at',
      travellers: 'id, trip_id, updated_at',
      items: 'id, trip_id, category, updated_at',
      categories: 'id, user_id, updated_at',
      templates: 'id, user_id, updated_at',
      templateItems: 'id, template_id, updated_at',
      preferences: 'id, user_id, updated_at',
      conversations: 'id, user_id, trip_id, updated_at',
      messages: 'id, conversation_id, created_at, updated_at',
      actionLogs: 'id, conversation_id, created_at, updated_at',
      outbox: 'key, table, queued_at',
      meta: 'key'
    });
  }
}

export const db = new VoyagoDB();

export async function getMeta<T>(key: string, fallback: T): Promise<T> {
  const r = await db.meta.get(key);
  return (r ? (r.value as T) : fallback);
}
export async function setMeta(key: string, value: unknown): Promise<void> {
  await db.meta.put({ key, value });
}
