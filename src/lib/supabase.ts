import { createClient, type SupabaseClient } from '@supabase/supabase-js';
import { getBackendConfig } from './config';

let client: SupabaseClient | null = null;
let builtFor = '';

export function getSupabase(): SupabaseClient | null {
  const cfg = getBackendConfig();
  if (!cfg) return null;
  const sig = cfg.url + cfg.anonKey;
  if (!client || builtFor !== sig) {
    client = createClient(cfg.url, cfg.anonKey, {
      auth: { persistSession: true, autoRefreshToken: true, detectSessionInUrl: false },
      realtime: { params: { eventsPerSecond: 10 } }
    });
    builtFor = sig;
  }
  return client;
}
