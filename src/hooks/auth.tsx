import { createContext, useCallback, useContext, useEffect, useRef, useState, type ReactNode } from 'react';
import type { Session } from '@supabase/supabase-js';
import { getBackendConfig } from '../lib/config';
import { getSupabase } from '../lib/supabase';
import { LOCAL_UID, setUid } from '../lib/session';
import { SyncEngine, adoptLocalData, wipeLocal } from '../db/sync';

type Phase = 'loading' | 'local' | 'signedOut' | 'signedIn';
interface AuthCtx {
  phase: Phase;
  email: string | null;
  signIn: (email: string, password: string) => Promise<string | null>;
  signUp: (email: string, password: string) => Promise<string | null>;
  signOut: () => Promise<void>;
  reload: () => void;
  syncNow: () => void;
}

const Ctx = createContext<AuthCtx>({
  phase: 'loading', email: null, signIn: async () => null, signUp: async () => null, signOut: async () => undefined, reload: () => undefined, syncNow: () => undefined
});
export const useAuth = () => useContext(Ctx);

export function AuthProvider({ children }: { children: ReactNode }) {
  const [phase, setPhase] = useState<Phase>('loading');
  const [email, setEmail] = useState<string | null>(null);
  const engine = useRef<SyncEngine | null>(null);
  const [tick, setTick] = useState(0);

  const attach = useCallback(async (session: Session) => {
    const client = getSupabase();
    if (!client) return;
    engine.current?.stop();
    setUid(session.user.id);
    await adoptLocalData(session.user.id);
    setEmail(session.user.email ?? null);
    setPhase('signedIn');
    const e = new SyncEngine(client, session.user.id);
    engine.current = e;
    void e.start();
  }, []);

  useEffect(() => {
    let cancelled = false;
    const client = getSupabase();
    if (!getBackendConfig() || !client) {
      engine.current?.stop();
      setUid(LOCAL_UID);
      setEmail(null);
      setPhase('local');
      return;
    }
    client.auth.getSession().then(({ data }) => {
      if (cancelled) return;
      if (data.session) void attach(data.session);
      else { setUid(LOCAL_UID); setPhase('signedOut'); }
    });
    const { data: sub } = client.auth.onAuthStateChange((event, session) => {
      if (event === 'SIGNED_IN' && session) void attach(session);
    });
    return () => { cancelled = true; sub.subscription.unsubscribe(); };
  }, [tick, attach]);

  const signIn = useCallback(async (em: string, pw: string) => {
    const c = getSupabase();
    if (!c) return 'Backend is not configured';
    const { error } = await c.auth.signInWithPassword({ email: em, password: pw });
    return error ? error.message : null;
  }, []);

  const signUp = useCallback(async (em: string, pw: string) => {
    const c = getSupabase();
    if (!c) return 'Backend is not configured';
    const { data, error } = await c.auth.signUp({ email: em, password: pw });
    if (error) return error.message;
    if (!data.session) return 'Check your email to confirm your account, then sign in.';
    return null;
  }, []);

  const signOut = useCallback(async () => {
    engine.current?.stop();
    engine.current = null;
    await getSupabase()?.auth.signOut();
    await wipeLocal();
    setUid(LOCAL_UID);
    setEmail(null);
    setPhase(getBackendConfig() ? 'signedOut' : 'local');
  }, []);

  return (
    <Ctx.Provider value={{ phase, email, signIn, signUp, signOut, reload: () => setTick((t) => t + 1), syncNow: () => void engine.current?.syncNow() }}>
      {children}
    </Ctx.Provider>
  );
}
