import { useRef, useState } from 'react';
import { Button, Card, Chip, Field, Input, Select, Sheet, TopBar, useUi } from '../components/ui';
import { Icon } from '../components/icons';
import { useAuth } from '../hooks/auth';
import { useDisplayName, usePreferences, useSyncStatus } from '../hooks/data';
import { addPreference, deleteAllMyData, deletePreference, exportAll, importAll, updatePreference } from '../db/repo';
import { getBackendConfig, saveBackendConfig } from '../lib/config';
import { describeScope } from '../lib/prefs';
import type { PrefEffect, PrefKind, Preference } from '../types';

const EFFECT_LABEL: Record<PrefEffect, string> = { include: 'Always include', exclude: 'Leave out', quantity: 'Set quantity', note: 'Remember as note' };

export default function Profile() {
  const { phase, email, signOut, reload, syncNow } = useAuth();
  const sync = useSyncStatus();
  const prefs = usePreferences();
  const [name, setName] = useDisplayName();
  const { toast, confirm } = useUi();
  const [draft, setDraft] = useState(name);
  const [backendOpen, setBackendOpen] = useState(false);
  const [prefOpen, setPrefOpen] = useState<Preference | 'new' | null>(null);
  const file = useRef<HTMLInputElement>(null);

  async function doExport() {
    const blob = new Blob([await exportAll()], { type: 'application/json' });
    const a = document.createElement('a');
    a.href = URL.createObjectURL(blob);
    a.download = `voyago-backup-${new Date().toISOString().slice(0, 10)}.json`;
    a.click();
    URL.revokeObjectURL(a.href);
  }
  async function doImport(e: React.ChangeEvent<HTMLInputElement>) {
    const f = e.target.files?.[0];
    e.target.value = '';
    if (!f) return;
    try { toast(`Imported ${await importAll(await f.text())} records`); } catch (err) { toast(`Import failed: ${(err as Error).message}`); }
  }
  async function wipe() {
    if (!(await confirm({ title: 'Delete all your data?', body: 'Trips, lists, templates and Travel Memory are removed from this device and your account. This cannot be undone.', confirmLabel: 'Delete everything', danger: true }))) return;
    await deleteAllMyData();
    toast('All data deleted');
  }

  return (
    <div>
      <TopBar title="Profile" />
      <div className="px-4 pb-10 space-y-4">
        <Card className="p-4 space-y-3">
          <Field label="Your name"><Input value={draft} onChange={(e) => setDraft(e.target.value)} onBlur={() => setName(draft)} placeholder="Shown in your greeting" /></Field>
          <div className="flex items-center gap-2 text-sm">
            <Icon name={phase === 'signedIn' ? 'Cloud' : 'WifiOff'} size={18} className={phase === 'signedIn' ? 'text-teal' : 'text-slate2'} />
            <span className="flex-1 font-semibold">{phase === 'signedIn' ? email : 'Offline mode. Data stays on this device.'}</span>
            {phase === 'signedIn' && <Chip tone={sync.status === 'error' ? 'danger' : sync.status === 'offline' ? 'warn' : 'ok'}>{sync.status === 'syncing' ? 'Syncing' : sync.status === 'offline' ? 'Offline' : sync.status === 'error' ? 'Error' : sync.pending ? `${sync.pending} pending` : 'Synced'}</Chip>}
          </div>
          <div className="flex gap-2 flex-wrap">
            {phase === 'signedIn' ? (
              <>
                <Button small variant="secondary" icon="RefreshCw" onClick={syncNow}>Sync now</Button>
                <Button small variant="secondary" icon="LogOut" onClick={async () => { if (await confirm({ title: 'Sign out?', body: 'Local copy on this device is cleared. Your cloud data stays safe.', confirmLabel: 'Sign out' })) await signOut(); }}>Sign out</Button>
              </>
            ) : null}
            <Button small variant="secondary" icon="Settings" onClick={() => setBackendOpen(true)}>Connect backend</Button>
          </div>
        </Card>

        <section>
          <div className="flex items-center justify-between mb-2">
            <h2 className="font-extrabold flex items-center gap-2"><Icon name="Brain" size={18} className="text-teal" />Travel Memory</h2>
            <Button small variant="secondary" icon="Plus" onClick={() => setPrefOpen('new')}>Add</Button>
          </div>
          <p className="text-xs text-slate2 mb-3">Preferences Voyago uses when it suggests items. Nothing is saved here without you seeing it, and you can edit or delete anything.</p>
          {!prefs ? null : prefs.length === 0 ? (
            <Card className="p-4 text-sm text-slate2">Nothing saved yet. Add one, for example “I never need formal shoes on vacations”.</Card>
          ) : (
            <div className="space-y-2">
              {prefs.map((p) => (
                <Card key={p.id} className={`p-3.5 ${p.active ? '' : 'opacity-60'}`}>
                  <div className="flex items-start gap-2">
                    <div className="flex-1 min-w-0">
                      <p className="font-semibold">“{p.statement}”</p>
                      <p className="text-xs text-slate2 mt-1">{EFFECT_LABEL[p.effect]}: {p.item_name}{p.quantity ? ` (${p.quantity})` : ''} · {describeScope(p)} · {p.source === 'chat' ? 'from chat' : 'added by you'}</p>
                    </div>
                    <button aria-label="Edit" className="h-9 w-9 grid place-items-center" onClick={() => setPrefOpen(p)}><Icon name="Pencil" size={17} /></button>
                    <button aria-label="Delete" className="h-9 w-9 grid place-items-center text-danger" onClick={async () => { await deletePreference(p.id); toast('Preference deleted'); }}><Icon name="Trash2" size={17} /></button>
                  </div>
                  <label className="flex items-center gap-2 text-xs font-semibold mt-2">
                    <input type="checkbox" className="h-4 w-4 accent-teal" checked={p.active} onChange={(e) => void updatePreference(p.id, { active: e.target.checked })} /> Active
                  </label>
                </Card>
              ))}
            </div>
          )}
        </section>

        <Card className="p-4 space-y-2">
          <h2 className="font-extrabold">Backup</h2>
          <div className="flex gap-2 flex-wrap">
            <Button small variant="secondary" icon="Download" onClick={doExport}>Export JSON</Button>
            <Button small variant="secondary" icon="Upload" onClick={() => file.current?.click()}>Import JSON</Button>
            <input ref={file} type="file" accept="application/json,.json" className="hidden" onChange={doImport} aria-label="Import backup file" />
          </div>
          <Button small variant="ghost" icon="Trash2" className="!text-danger" onClick={wipe}>Delete all my data</Button>
        </Card>

        <p className="text-center text-xs text-slate2">Voyago · your trips, packed right</p>
      </div>

      <BackendSheet open={backendOpen} onClose={() => setBackendOpen(false)} onSaved={() => { setBackendOpen(false); reload(); }} />
      <PrefSheet pref={prefOpen} onClose={() => setPrefOpen(null)} />
    </div>
  );
}

function BackendSheet({ open, onClose, onSaved }: { open: boolean; onClose: () => void; onSaved: () => void }) {
  const cur = getBackendConfig();
  const [url, setUrl] = useState(cur?.url ?? '');
  const [key, setKey] = useState(cur?.anonKey ?? '');
  const [err, setErr] = useState('');
  function save() {
    if (!/^https:\/\/[a-z0-9-]+\.supabase\.co\/?$/i.test(url.trim())) return setErr('Enter the project URL, like https://xxxx.supabase.co');
    if (/service_role/i.test(key) || key.trim().startsWith('sb_secret_')) return setErr('That is a secret key. Never use it here. Use the publishable / anon key.');
    if (key.trim().length < 20) return setErr('Enter the publishable / anon key');
    saveBackendConfig({ url, anonKey: key });
    onSaved();
  }
  return (
    <Sheet open={open} onClose={onClose} title="Connect backend">
      <div className="space-y-3">
        <p className="text-sm text-slate2">Your Supabase project. Only the public URL and publishable key go here, never a secret key.</p>
        <Field label="Project URL"><Input value={url} onChange={(e) => setUrl(e.target.value)} placeholder="https://xxxx.supabase.co" autoCapitalize="none" /></Field>
        <Field label="Publishable / anon key"><Input value={key} onChange={(e) => setKey(e.target.value)} autoCapitalize="none" /></Field>
        {err && <p className="text-danger text-sm font-semibold" role="alert">{err}</p>}
        <Button full onClick={save}>Save and connect</Button>
        <Button full variant="ghost" onClick={() => { saveBackendConfig(null); onSaved(); }}>Disconnect (offline only)</Button>
      </div>
    </Sheet>
  );
}

function PrefSheet({ pref, onClose }: { pref: Preference | 'new' | null; onClose: () => void }) {
  if (!pref) return null;
  const isNew = pref === 'new';
  return <PrefForm key={isNew ? 'new' : pref.id} pref={isNew ? null : pref} onClose={onClose} />;
}

function PrefForm({ pref, onClose }: { pref: Preference | null; onClose: () => void }) {
  const { toast } = useUi();
  const [f, setF] = useState({
    statement: pref?.statement ?? '', item_name: pref?.item_name ?? '', effect: (pref?.effect ?? 'exclude') as PrefEffect,
    quantity: pref?.quantity ? String(pref.quantity) : '', scope: pref ? (pref.trip_types.length ? 'type' : 'all') : 'all',
    type: pref?.trip_types[0] ?? 'vacation', min: pref?.min_nights != null ? String(pref.min_nights) : '', max: pref?.max_nights != null ? String(pref.max_nights) : ''
  });
  const [err, setErr] = useState('');
  async function save() {
    if (!f.item_name.trim()) return setErr('What item is this about?');
    if (f.effect === 'quantity' && !(Number(f.quantity) > 0)) return setErr('Enter a quantity');
    const trip_types = f.scope === 'type' ? [f.type] : [];
    const kind: PrefKind = f.scope === 'type' ? 'trip_type' : f.effect === 'exclude' ? 'avoid' : 'permanent';
    const body = {
      kind, statement: f.statement.trim() || `${EFFECT_LABEL[f.effect]}: ${f.item_name.trim()}`, item_name: f.item_name.trim(), category: pref?.category ?? null,
      effect: f.effect, quantity: f.effect === 'quantity' ? Number(f.quantity) : null, trip_types,
      min_nights: f.min ? Number(f.min) : null, max_nights: f.max ? Number(f.max) : null, source: pref?.source ?? ('manual' as const)
    };
    if (pref) await updatePreference(pref.id, body); else await addPreference(body);
    toast(pref ? 'Preference updated' : 'Preference saved');
    onClose();
  }
  return (
    <Sheet open onClose={onClose} title={pref ? 'Edit preference' : 'New preference'}>
      <div className="space-y-3">
        <Field label="In your words (optional)"><Input value={f.statement} onChange={(e) => setF({ ...f, statement: e.target.value })} placeholder="I don't need formal shoes on vacations" /></Field>
        <Field label="Item"><Input value={f.item_name} onChange={(e) => setF({ ...f, item_name: e.target.value })} placeholder="Formal shoes" /></Field>
        <Field label="What should Voyago do?">
          <Select value={f.effect} onChange={(e) => setF({ ...f, effect: e.target.value as PrefEffect })}>
            {(Object.keys(EFFECT_LABEL) as PrefEffect[]).map((k) => <option key={k} value={k}>{EFFECT_LABEL[k]}</option>)}
          </Select>
        </Field>
        {f.effect === 'quantity' && <Field label="Quantity"><Input type="number" min={1} value={f.quantity} onChange={(e) => setF({ ...f, quantity: e.target.value })} /></Field>}
        <Field label="Applies to">
          <Select value={f.scope} onChange={(e) => setF({ ...f, scope: e.target.value })}><option value="all">Every trip</option><option value="type">One trip type only</option></Select>
        </Field>
        {f.scope === 'type' && <Field label="Trip type"><Select value={f.type} onChange={(e) => setF({ ...f, type: e.target.value })}>{['vacation', 'business', 'wedding', 'adventure', 'medical', 'other'].map((t) => <option key={t}>{t}</option>)}</Select></Field>}
        <div className="grid grid-cols-2 gap-3">
          <Field label="Min nights (optional)"><Input type="number" min={0} value={f.min} onChange={(e) => setF({ ...f, min: e.target.value })} /></Field>
          <Field label="Max nights (optional)"><Input type="number" min={0} value={f.max} onChange={(e) => setF({ ...f, max: e.target.value })} /></Field>
        </div>
        {err && <p className="text-danger text-sm font-semibold" role="alert">{err}</p>}
        <Button full onClick={save}>Save</Button>
      </div>
    </Sheet>
  );
}
