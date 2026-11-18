export type TripType = 'vacation' | 'business' | 'wedding' | 'adventure' | 'medical' | 'other';
export type TravelMode = 'flight' | 'train' | 'road' | 'other';
export type TravellerType = 'solo' | 'couple' | 'family' | 'group';
export type Priority = 'essential' | 'optional';
export type ItemSource = 'manual' | 'template' | 'generator' | 'ai';

export interface Base {
  id: string;
  user_id: string;
  created_at: string;
  updated_at: string;
  deleted: boolean;
}

export interface WeatherSummary {
  min_c: number;
  max_c: number;
  avg_c: number;
  rain_pct: number;
  basis: 'forecast' | 'last-year';
  fetched_at: string;
}

export interface Trip extends Base {
  name: string;
  destination: string;
  start_date: string; // YYYY-MM-DD
  end_date: string;
  travellers_count: number;
  traveller_type: TravellerType;
  trip_type: TripType;
  travel_mode: TravelMode;
  accommodation: string;
  notes: string;
  cover_image: string | null;
  weather: WeatherSummary | null;
  status: 'planning' | 'packed' | 'completed';
  international: boolean;
  budget?: number | null;
}

export interface Traveller extends Base {
  trip_id: string;
  name: string;
  kind: 'adult' | 'child' | 'infant';
}

export interface Item extends Base {
  trip_id: string;
  name: string;
  category: string;
  quantity: number;
  packed: boolean;
  priority: Priority;
  notes: string;
  bag: string | null;
  sort_order: number;
  source: ItemSource;
  /** 'last_minute' = goes in on the morning you leave (charger, wallet, medicines in use) */
  pack_when?: 'any' | 'last_minute';
}

export interface Category extends Base {
  name: string;
  icon: string;
  sort_order: number;
}

export interface Template extends Base {
  name: string;
  description: string;
  trip_type: TripType;
  nights: number;
}

export interface TemplateItem extends Base {
  template_id: string;
  name: string;
  category: string;
  quantity: number;
  priority: Priority;
  notes: string;
  bag: string | null;
}

export type PrefKind = 'permanent' | 'trip_type' | 'frequent' | 'avoid' | 'context';
export type PrefEffect = 'include' | 'exclude' | 'quantity' | 'note';

export interface Preference extends Base {
  kind: PrefKind;
  statement: string; // the user's own words
  item_name: string; // what it is about, e.g. "formal shoes"
  category: string | null;
  effect: PrefEffect;
  quantity: number | null;
  trip_types: string[]; // empty = every trip type
  min_nights: number | null;
  max_nights: number | null;
  source: 'chat' | 'manual';
  active: boolean;
}

export interface Conversation extends Base {
  trip_id: string | null;
  title: string;
}

export interface ChatMessage {
  id: string;
  user_id: string;
  conversation_id: string;
  role: 'user' | 'assistant';
  content: string;
  actions: unknown[] | null;
  created_at: string;
  updated_at: string;
  deleted: boolean;
}

export interface ActionLog {
  id: string;
  user_id: string;
  conversation_id: string | null;
  action_type: string;
  summary: string;
  table_name: string;
  entity_id: string;
  before: unknown;
  after: unknown;
  undone: boolean;
  created_at: string;
  updated_at: string;
  deleted: boolean;
}

export interface OutboxEntry {
  key: string; // `${table}:${id}`
  table: SyncTable;
  id: string;
  row: unknown;
  queued_at: string;
  attempts: number;
}

export type SyncTable =
  | 'trips'
  | 'travellers'
  | 'items'
  | 'categories'
  | 'templates'
  | 'templateItems'
  | 'preferences'
  | 'conversations'
  | 'messages'
  | 'actionLogs'
  | 'documents'
  | 'itinerary'
  | 'bookings'
  | 'expenses'
  | 'journal';

/** local table name -> Postgres table name */
export const REMOTE_TABLE: Record<SyncTable, string> = {
  trips: 'trips',
  travellers: 'travellers',
  items: 'packing_items',
  categories: 'packing_categories',
  templates: 'packing_templates',
  templateItems: 'template_items',
  preferences: 'user_preferences',
  conversations: 'chat_conversations',
  messages: 'chat_messages',
  actionLogs: 'ai_action_logs',
  documents: 'trip_documents',
  itinerary: 'itinerary_items',
  bookings: 'bookings',
  expenses: 'expenses',
  journal: 'journal_entries'
};

/** Tables the client may write to. actionLogs are written by the server only. */
export const WRITABLE: SyncTable[] = [
  'trips',
  'travellers',
  'items',
  'categories',
  'templates',
  'templateItems',
  'preferences',
  'conversations',
  'messages',
  'documents',
  'itinerary',
  'bookings',
  'expenses',
  'journal'
];

export interface TripDocument extends Base {
  trip_id: string; kind: string; title: string; notes: string;
  file_name: string | null; mime: string | null; size_bytes: number | null; storage_path: string | null;
}
export interface ItineraryItem extends Base {
  trip_id: string; kind: 'plan' | 'gem'; day_date: string | null; start_time: string | null;
  title: string; location: string; notes: string; tag: string; done: boolean; sort_order: number;
}
export interface Booking extends Base {
  trip_id: string; kind: string; title: string; provider: string; reference: string;
  start_date: string | null; end_date: string | null; amount: number | null;
  status: 'confirmed' | 'pending' | 'cancelled'; notes: string;
}
export interface Expense extends Base {
  trip_id: string; category: string; amount: number; note: string; spent_on: string | null; paid_by: string;
}
export interface JournalEntry extends Base {
  trip_id: string; entry_date: string | null; place: string; body: string; photo: string | null;
}
