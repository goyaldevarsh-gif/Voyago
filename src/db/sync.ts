import type { SupabaseClient, RealtimeChannel } from '@supabase/supabase-js';
import { db, getMeta, setMeta } from './local';
import { onOutboxChange } from './repo';
import { REMOTE_TABLE, WRITABLE, type SyncTable } from '../types';
import { LOCAL_UID } from '../lib/session';

/** Parents before children, so foreign keys always resolve. */
const PUSH_ORDER: SyncTable[] = ['trips', 'travellers', 'categories', 'templates', 'templateItems', 'items', 'preferences', 'conversations', 'messages'];
const PULL_ORDER: SyncTable[] = ['trips', 'travellers', 'categories', 'templates', 'templateItems', 'items', 'preferences', 'conversations', 'messages', 'actionLogs'];
const MAX_ATTEMPTS = 8;

export interface SyncState {
  status: 'off' | 'idle' | 'syncing' | 'offline' | 'error';
  pending: number;
  lastSync: string | null;
  error: string | null;
}

let state: SyncState = { status: 'off', pending: 0, lastSync: null, error: null };
const subs = new Set<(s: SyncState) => void>();
export const getSyncState = () => state;
export function onSyncState(f: (s: SyncState) => void) { subs.add(f); return () => { subs.delete(f); }; }
function setState(p: Partial<SyncState>) { state = { ...state, ...p }; subs.forEach((f) => f(state)); }

const isoNorm = (s: unknown) => (typeof s === 'string' ? new Date(s).toISOString() : (s as string));

/** Postgres returns +00:00 timestamps with microseconds; the app stores UTC ISO strings with milliseconds. */
function normaliseRow(row: Record<string, unknown>): Record<string, unknown> {
  const out = { ...row };
  for (const k of ['created_at', 'updated_at']) if (k in out) out[k] = isoNorm(out[k]);
  return out;
}

export class SyncEngine {
  private channel: RealtimeChannel | null = null;
  private running = false;
  private pushing: Promise<void> | null = null;
  private timer: ReturnType<typeof setTimeout> | null = null;
  private poll: ReturnType<typeof setInterval> | null = null;
  private onlineHandler = () => { void this.syncNow(); };
  private offlineHandler = () => setState({ status: 'offline' });

  constructor(private client: SupabaseClient, private uid: string) {}

  async start(): Promise<void> {
    if (this.running) return;
    this.running = true;
    setState({ status: 'idle', error: null });
    onOutboxChange(() => this.schedulePush());
    window.addEventListener('online', this.onlineHandler);
    window.addEventListener('offline', this.offlineHandler);
    this.subscribe();
    this.poll = setInterval(() => { void this.pull().catch(() => undefined); }, 60_000);
    await this.syncNow();
  }

  stop(): void {
    this.running = false;
    if (this.timer) clearTimeout(this.timer);
    if (this.poll) clearInterval(this.poll);
    window.removeEventListener('online', this.onlineHandler);
    window.removeEventListener('offline', this.offlineHandler);
    if (this.channel) void this.client.removeChannel(this.channel);
    this.channel = null;
    onOutboxChange(() => undefined);
    setState({ status: 'off', pending: 0 });
  }

  /** Push local changes first, then pull what changed elsewhere. */
  async syncNow(): Promise<void> {
    if (!this.running) return;
    if (!navigator.onLine) { setState({ status: 'offline' }); return; }
    setState({ status: 'syncing' });
    try {
      await this.push();
      await this.pull();
      await this.refreshPending();
      setState({ status: 'idle', lastSync: new Date().toISOString(), error: null });
    } catch (e) {
      const msg = e instanceof Error ? e.message : String(e);
      setState({ status: isNetworkError(e) ? 'offline' : 'error', error: msg });
    }
  }

  private schedulePush() {
    void this.refreshPending();
    if (this.timer) clearTimeout(this.timer);
    this.timer = setTimeout(() => { void this.push().then(() => this.refreshPending()).catch((e) => {
      setState({ status: isNetworkError(e) ? 'offline' : 'error', error: e instanceof Error ? e.message : String(e) });
    }); }, 400);
  }

  private async refreshPending() { setState({ pending: await db.outbox.count() }); }

  /* ---------------- push ---------------- */

  async push(): Promise<void> {
    if (this.pushing) return this.pushing; // never run two pushes at once
    this.pushing = this.doPush().finally(() => { this.pushing = null; });
    return this.pushing;
  }

  private async doPush(): Promise<void> {
    for (const table of PUSH_ORDER) {
      if (!WRITABLE.includes(table)) continue;
      const entries = await db.outbox.where('table').equals(table).toArray();
      for (let i = 0; i < entries.length; i += 100) {
        const chunk = entries.slice(i, i + 100);
        const rows = chunk.map((e) => ({ ...(e.row as Record<string, unknown>), user_id: this.uid }));
        const { error } = await this.client.from(REMOTE_TABLE[table]).upsert(rows, { onConflict: 'id' });
        if (!error) {
          // delete only entries that were not rewritten while we were sending
          for (const e of chunk) {
            const cur = await db.outbox.get(e.key);
            if (cur && cur.queued_at === e.queued_at) await db.outbox.delete(e.key);
          }
          continue;
        }
        if (isNetworkMessage(error.message)) throw new Error(error.message);
        await this.handlePushError(table, chunk, error.code ?? '', error.message);
      }
    }
  }

  /** Retry rows one by one so a single bad row cannot block the others. */
  private async handlePushError(table: SyncTable, chunk: { key: string; id: string; row: unknown; attempts: number; queued_at: string }[], code: string, message: string) {
    for (const e of chunk) {
      const row = { ...(e.row as Record<string, unknown>), user_id: this.uid };
      const { error } = await this.client.from(REMOTE_TABLE[table]).upsert(row, { onConflict: 'id' });
      if (!error) { await db.outbox.delete(e.key); continue; }
      if (isNetworkMessage(error.message)) throw new Error(error.message);
      if (error.code === '23505' && table === 'items') {
        // someone already created this item: the server copy wins, drop ours
        await db.items.update(e.id, { deleted: true });
        await db.outbox.delete(e.key);
        continue;
      }
      const attempts = e.attempts + 1;
      if (attempts >= MAX_ATTEMPTS || error.code === '42501' || error.code === '22P02') {
        await db.outbox.delete(e.key); // permanently rejected: do not retry forever
        setState({ error: `Dropped a change to ${table}: ${error.message}` });
      } else {
        await db.outbox.update(e.key, { attempts });
      }
    }
    void code; void message;
  }

  /* ---------------- pull ---------------- */

  async pull(): Promise<void> {
    for (const table of PULL_ORDER) {
      const metaKey = `pull:${this.uid}:${table}`;
      let since = await getMeta<string>(metaKey, '1970-01-01T00:00:00.000Z');
      for (;;) {
        const { data, error } = await this.client.from(REMOTE_TABLE[table]).select('*')
          .gte('updated_at', since).order('updated_at', { ascending: true }).limit(500);
        if (error) throw new Error(error.message);
        if (!data || data.length === 0) break;
        await this.apply(table, data as Record<string, unknown>[]);
        const last = isoNorm((data[data.length - 1] as Record<string, unknown>).updated_at);
        const advanced = last > since;
        since = last;
        await setMeta(metaKey, since);
        if (data.length < 500 || !advanced) break;
      }
    }
  }

  /** Last-write-wins by updated_at; never overwrite a local change that is still waiting to be pushed. */
  async apply(table: SyncTable, rows: Record<string, unknown>[]): Promise<void> {
    await db.transaction('rw', [db.table(table), db.outbox], async () => {
      for (const raw of rows) {
        const row = normaliseRow(raw) as { id: string; updated_at: string };
        const local = (await db.table(table).get(row.id)) as { updated_at: string } | undefined;
        const pending = await db.outbox.get(`${table}:${row.id}`);
        const pendingNewer = pending && (pending.row as { updated_at: string }).updated_at >= row.updated_at;
        if (pendingNewer) continue;
        if (!local || row.updated_at > local.updated_at) await db.table(table).put(row);
      }
    });
  }

  /* ---------------- realtime ---------------- */

  private subscribe() {
    let ch = this.client.channel(`voyago-${this.uid}`);
    for (const table of PULL_ORDER) {
      ch = ch.on(
        'postgres_changes',
        { event: '*', schema: 'public', table: REMOTE_TABLE[table], filter: `user_id=eq.${this.uid}` },
        (payload) => {
          if (payload.eventType === 'DELETE') {
            const old = payload.old as { id?: string };
            if (old.id) void db.table(table).delete(old.id);
            return;
          }
          void this.apply(table, [payload.new as Record<string, unknown>]);
        }
      );
    }
    this.channel = ch.subscribe((status) => {
      // after (re)connecting, catch up on anything missed while disconnected
      if (status === 'SUBSCRIBED') void this.pull().catch(() => undefined);
    });
  }
}

function isNetworkMessage(m: string): boolean {
  return /failed to fetch|networkerror|network request failed|load failed|fetch failed/i.test(m);
}
function isNetworkError(e: unknown): boolean {
  return e instanceof TypeError || (e instanceof Error && isNetworkMessage(e.message)) || !navigator.onLine;
}

/** Called once after sign-in: data created in local mode becomes the user's own. */
export async function adoptLocalData(uid: string): Promise<number> {
  let n = 0;
  for (const t of WRITABLE) {
    const rows = (await db.table(t).toArray()) as { id: string; user_id: string; updated_at: string }[];
    for (const r of rows.filter((x) => x.user_id === LOCAL_UID)) {
      const next = { ...r, user_id: uid };
      await db.table(t).put(next);
      await db.outbox.put({ key: `${t}:${r.id}`, table: t, id: r.id, row: next, queued_at: new Date().toISOString(), attempts: 0 });
      n++;
    }
  }
  return n;
}

/** Called on sign-out so the next person on this device never sees someone else's trips. */
export async function wipeLocal(): Promise<void> {
  await db.transaction('rw', db.tables, async () => {
    for (const t of db.tables) await t.clear();
  });
}
