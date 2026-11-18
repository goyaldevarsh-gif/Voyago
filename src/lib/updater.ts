import { registerSW } from 'virtual:pwa-register';

type Listener = (ready: boolean) => void;
const listeners = new Set<Listener>();
let ready = false;
let apply: ((reload?: boolean) => Promise<void>) | null = null;

export function onUpdateReady(f: Listener): () => void {
  listeners.add(f);
  f(ready);
  return () => { listeners.delete(f); };
}

/** Installs the new version and reloads the app. */
export function applyUpdate(): void {
  void apply?.(true);
}

export function initUpdater(): void {
  apply = registerSW({
    immediate: true,
    onNeedRefresh() { ready = true; listeners.forEach((f) => f(true)); },
    onRegisteredSW(_url, reg) {
      if (!reg) return;
      const check = () => { void reg.update().catch(() => undefined); };
      setInterval(check, 15 * 60 * 1000);
      document.addEventListener('visibilitychange', () => { if (document.visibilityState === 'visible') check(); });
    }
  });
}
