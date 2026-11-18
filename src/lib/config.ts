const KEY = 'voyago.backend';

export interface BackendConfig {
  url: string;
  anonKey: string;
}

/** Build-time env wins, then whatever the user pasted in Profile -> Connect backend. */
export function getBackendConfig(): BackendConfig | null {
  const url = import.meta.env.VITE_SUPABASE_URL as string | undefined;
  const anonKey = import.meta.env.VITE_SUPABASE_ANON_KEY as string | undefined;
  if (url && anonKey) return { url, anonKey };
  try {
    const raw = localStorage.getItem(KEY);
    if (raw === 'off') return null;
    if (!raw) return DEFAULT_PROJECT;
    const c = JSON.parse(raw) as BackendConfig;
    return c.url && c.anonKey ? c : null;
  } catch {
    return null;
  }
}

/** Public project URL + publishable (anon-level) key. Safe to ship: access is enforced by Row Level Security. */
const DEFAULT_PROJECT: BackendConfig = {
  url: 'https://ylvlgsjirgrxergtyrsh.supabase.co',
  anonKey: 'sb_publishable_xlOxSOZVdhTeFBlNFjHATg_VZCSUpfi'
};

export function saveBackendConfig(c: BackendConfig | null): void {
  if (c) localStorage.setItem(KEY, JSON.stringify({ url: c.url.trim().replace(/\/$/, ''), anonKey: c.anonKey.trim() }));
  else localStorage.setItem(KEY, 'off');
}
