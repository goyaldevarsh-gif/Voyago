import { useEffect, useMemo, useState } from 'react';
import { useParams, useSearchParams } from 'react-router-dom';
import { Button, Chip, EmptyState, Field, IconButton, Input, ProgressBar, Select, Sheet, Stepper, TopBar, Textarea, useUi } from '../components/ui';
import { Icon } from '../components/icons';
import { useCategories, useItems, usePreferences, useTemplates, useTrip } from '../hooks/data';
import { addCategory, addItem, addItems, deleteItem, moveItem, restoreItem, setManyPacked, setPacked, statsOf, updateItem, deleteCategory } from '../db/repo';
import { db } from '../db/local';
import { BAGS, DEFAULT_CATEGORIES, searchCatalog } from '../data/catalog';
import { generateForTrip } from '../lib/generator';
import { nightsOf } from '../lib/util';
import { isLastMinute } from '../lib/lastMinute';
import type { Item, Priority } from '../types';

type Filter = 'all' | 'pending' | 'packed' | 'essential' | 'last';
const catIcon = (n: string) => DEFAULT_CATEGORIES.find((c) => c.name === n)?.icon ?? 'Package';

export default function Packing() {
  const { id } = useParams();
  const trip = useTrip(id);
  const items = useItems(id);
  const prefs = usePreferences();
  const cats = useCategories();
  const [sp, setSp] = useSearchParams();
  const { toast } = useUi();
  const [q, setQ] = useState('');
  const [filter, setFilter] = useState<Filter>('all');
  const [view, setView] = useState<'category' | 'bag'>('category');
  const [addOpen, setAddOpen] = useState(false);
  const [genOpen, setGenOpen] = useState(false);
  const [edit, setEdit] = useState<Item | null>(null);
  const [closed, setClosed] = useState<Set<string>>(new Set());
  const flip = (k: string) => setClosed((s) => { const x = new Set(s); if (x.has(k)) x.delete(k); else x.add(k); return x; });

  useEffect(() => {
    if (sp.get('generate') === '1' && trip && items && prefs) {
      setGenOpen(true);
      sp.delete('generate'); setSp(sp, { replace: true });
    }
  }, [sp, trip, items, prefs, setSp]);

  const catNames = useMemo(() => {
    const extra = (cats ?? []).map((c) => c.name);
    return [...DEFAULT_CATEGORIES.map((c) => c.name as string), ...extra.filter((n) => !DEFAULT_CATEGORIES.some((d) => d.name === n))];
  }, [cats]);

  if (!trip || !items || !prefs) return <div className="p-6 text-slate2">Loading…</div>;

  const s = statsOf(items);
  const shown = items.filter((i) => {
    if (q && !i.name.toLowerCase().includes(q.toLowerCase())) return false;
    if (filter === 'pending') return !i.packed;
    if (filter === 'packed') return i.packed;
    if (filter === 'essential') return i.priority === 'essential';
    if (filter === 'last') return isLastMinute(i);
    return true;
  });

  const groups = new Map<string, Item[]>();
  for (const i of shown) {
    const k = view === 'category' ? i.category : i.bag || 'Not assigned';
    groups.set(k, [...(groups.get(k) ?? []), i]);
  }
  const order = view === 'category' ? [...catNames, ...[...groups.keys()].filter((k) => !catNames.includes(k))] : [...BAGS, 'Not assigned'];
  const ordered = order.filter((k) => groups.has(k));

  async function remove(i: Item) {
    await deleteItem(i.id);
    toast(`Removed ${i.name}`, { label: 'Undo', run: () => { void restoreItem(i.id); } });
  }

  return (
    <div>
      <TopBar title="Packing list" sub={trip.name} back={`/trips/${trip.id}`}
        right={<IconButton icon="Sparkles" label="Smart generate" onClick={() => setGenOpen(true)} />} />
      <div className="px-4 space-y-3 pb-32">
        <div className="bg-white rounded-2xl shadow-card p-4">
          <div className="flex justify-between text-sm font-bold mb-2"><span>{s.packed} of {s.total} packed</span><span>{s.pct}%</span></div>
          <ProgressBar value={s.pct} />
          {s.essentialPending.length > 0 && <p className="text-xs text-amber-700 font-semibold mt-2">{s.essentialPending.length} essential item{s.essentialPending.length > 1 ? 's' : ''} still pending</p>}
        </div>

        <div className="relative">
          <Icon name="Search" size={18} className="absolute left-3.5 top-3.5 text-slate2" />
          <Input className="pl-10" placeholder="Search items" aria-label="Search items" value={q} onChange={(e) => setQ(e.target.value)} />
        </div>
        <div className="flex gap-2 overflow-x-auto pb-1 -mx-4 px-4">
          {(['all', 'pending', 'packed', 'essential', 'last'] as Filter[]).map((f) => <Chip key={f} active={filter === f} onClick={() => setFilter(f)}>{f === 'last' ? 'Last minute' : f[0].toUpperCase() + f.slice(1)}</Chip>)}
          <span className="w-px bg-slate-300 mx-1" />
          <Chip active={view === 'category'} onClick={() => setView('category')}>By category</Chip>
          <Chip active={view === 'bag'} onClick={() => setView('bag')}>By bag</Chip>
        </div>

        {items.length === 0 ? (
          <EmptyState icon="ListChecks" title="Nothing here yet" body="Let Voyago suggest a list for this trip, or add items yourself."
            action={<div className="flex gap-2 justify-center"><Button icon="Sparkles" onClick={() => setGenOpen(true)}>Smart generate</Button><Button variant="secondary" icon="Plus" onClick={() => setAddOpen(true)}>Add</Button></div>} />
        ) : ordered.length === 0 ? (
          <p className="text-center text-slate2 py-10 text-sm">No items match.</p>
        ) : ordered.map((k) => {
          const list = groups.get(k)!;
          const done = list.filter((i) => i.packed).length;
          return (
            <section key={k} className="bg-white rounded-2xl shadow-card overflow-hidden">
              <div className="flex items-center gap-2 px-4 py-3 bg-slate-50">
                <button className="flex items-center gap-2 flex-1 min-w-0 text-left h-8" aria-expanded={!closed.has(k)} onClick={() => flip(k)}>
                  <Icon name={view === 'category' ? catIcon(k) : 'Backpack'} size={18} className="text-teal shrink-0" />
                  <h2 className="font-extrabold flex-1 text-[15px] truncate">{k}</h2>
                  <Icon name={closed.has(k) ? 'ChevronRight' : 'ArrowDown'} size={16} className="text-slate2 shrink-0" />
                </button>
                <span className="text-xs font-bold text-slate2">{done}/{list.length}</span>
                <button className="text-xs font-bold text-teal px-2 h-8" onClick={() => void setManyPacked(list.map((i) => i.id), done !== list.length)}>
                  {done === list.length ? 'Unpack all' : 'Pack all'}
                </button>
              </div>
              {!closed.has(k) && <ul className="divide-y divide-slate-100">
                {list.map((i) => (
                  <li key={i.id} className="flex items-center gap-3 px-4 py-3">
                    <button role="checkbox" aria-checked={i.packed} aria-label={`Packed: ${i.name}`} onClick={() => void setPacked(i.id, !i.packed)}
                      className={`h-7 w-7 rounded-lg border-2 grid place-items-center shrink-0 transition ${i.packed ? 'bg-teal border-teal text-white' : 'border-slate-300'}`}>
                      {i.packed && <Icon name="Check" size={16} strokeWidth={3} />}
                    </button>
                    <button className="flex-1 min-w-0 text-left" onClick={() => setEdit(i)}>
                      <p className={`font-semibold leading-snug ${i.packed ? 'line-through text-slate-400' : ''}`}>
                        {i.priority === 'essential' && <Icon name="Star" size={13} className="inline text-warn fill-warn mr-1 -mt-0.5" />}{i.name}{isLastMinute(i) && !i.packed && <Icon name="Clock" size={13} className="inline text-teal ml-1.5 -mt-0.5" />}
                      </p>
                      {(i.notes || i.quantity > 1) && <p className="text-xs text-slate2 line-clamp-2">{i.quantity > 1 ? `×${i.quantity}` : ''}{i.quantity > 1 && i.notes ? ' · ' : ''}{i.notes}</p>}
                    </button>
                    <IconButton icon="Trash2" label={`Remove ${i.name}`} onClick={() => void remove(i)} className="text-slate-400" />
                  </li>
                ))}
              </ul>}
            </section>
          );
        })}
      </div>

      <button onClick={() => setAddOpen(true)} aria-label="Add item"
        className="fixed z-30 right-4 bottom-6 h-14 w-14 rounded-full bg-teal text-white shadow-lg grid place-items-center safe-b active:scale-95"><Icon name="Plus" size={26} /></button>

      <AddSheet open={addOpen} onClose={() => setAddOpen(false)} tripId={trip.id} catNames={catNames} />
      <GenerateSheet open={genOpen} onClose={() => setGenOpen(false)} tripId={trip.id} onDone={() => setGenOpen(false)} />
      <EditSheet item={edit} onClose={() => setEdit(null)} catNames={catNames} />
    </div>
  );
}

/* ---------- add item ---------- */
function AddSheet({ open, onClose, tripId, catNames }: { open: boolean; onClose: () => void; tripId: string; catNames: string[] }) {
  const [tab, setTab] = useState<'search' | 'custom' | 'template'>('search');
  const [q, setQ] = useState('');
  const templates = useTemplates();
  const { toast } = useUi();
  const [f, setF] = useState({ name: '', category: 'Miscellaneous', quantity: 1, priority: 'optional' as Priority, notes: '', bag: '' });
  const [newCat, setNewCat] = useState('');
  const results = q.trim() ? searchCatalog(q).slice(0, 12) : [];

  async function addOne(name: string, category: string, priority: Priority, bag: string | null, quantity = 1) {
    const r = await addItem(tripId, { name, category, quantity, priority, bag, source: 'manual' }, 'add');
    toast(r.merged ? `${name} already there, quantity updated` : `Added ${name}`);
  }
  async function custom() {
    if (!f.name.trim()) return;
    let category = f.category;
    if (category === '__new') {
      if (!newCat.trim()) return;
      await addCategory(newCat.trim()); category = newCat.trim();
    }
    await addOne(f.name.trim(), category, f.priority, f.bag || null, f.quantity);
    setF({ ...f, name: '', notes: '', quantity: 1 }); setNewCat('');
    onClose();
  }
  async function fromTemplate(id: string) {
    const rows = (await db.templateItems.where('template_id').equals(id).toArray()).filter((i) => !i.deleted);
    const r = await addItems(tripId, rows.map((i) => ({ name: i.name, category: i.category, quantity: i.quantity, priority: i.priority, bag: i.bag, source: 'template' as const })), 'keep');
    toast(`Added ${r.added} items from template`);
    onClose();
  }

  return (
    <Sheet open={open} onClose={onClose} title="Add item" tall>
      <div className="flex gap-2 mb-4">
        {(['search', 'custom', 'template'] as const).map((t) => <Chip key={t} active={tab === t} onClick={() => setTab(t)}>{t === 'search' ? 'Search' : t === 'custom' ? 'Custom' : 'Template'}</Chip>)}
      </div>
      {tab === 'search' && (
        <div className="space-y-2">
          <Input autoFocus placeholder="Search common items, e.g. sunscreen" aria-label="Search catalog" value={q} onChange={(e) => setQ(e.target.value)} />
          {results.map((r) => (
            <button key={r.name} className="w-full flex items-center gap-3 p-3 rounded-xl bg-slate-50 text-left active:bg-teal-50" onClick={() => void addOne(r.name, r.category, r.priority, r.bag)}>
              <div className="flex-1"><p className="font-semibold">{r.name}</p><p className="text-xs text-slate2">{r.category}</p></div>
              <Icon name="Plus" size={18} className="text-teal" />
            </button>
          ))}
          {q.trim() && results.length === 0 && <p className="text-sm text-slate2">No match. Use the Custom tab to add it.</p>}
          {!q.trim() && <p className="text-sm text-slate2">Type to search the built-in catalog.</p>}
        </div>
      )}
      {tab === 'custom' && (
        <div className="space-y-3">
          <Field label="Item name"><Input value={f.name} onChange={(e) => setF({ ...f, name: e.target.value })} /></Field>
          <Field label="Category">
            <Select value={f.category} onChange={(e) => setF({ ...f, category: e.target.value })}>
              {catNames.map((c) => <option key={c}>{c}</option>)}<option value="__new">+ New category…</option>
            </Select>
          </Field>
          {f.category === '__new' && <Field label="New category name"><Input value={newCat} onChange={(e) => setNewCat(e.target.value)} /></Field>}
          <Field label="Bag"><Select value={f.bag} onChange={(e) => setF({ ...f, bag: e.target.value })}><option value="">Not assigned</option>{BAGS.map((b) => <option key={b}>{b}</option>)}</Select></Field>
          <div className="flex items-center gap-4">
            <Stepper value={f.quantity} onChange={(n) => setF({ ...f, quantity: n })} />
            <Chip active={f.priority === 'essential'} onClick={() => setF({ ...f, priority: f.priority === 'essential' ? 'optional' : 'essential' })}>Essential</Chip>
          </div>
          <Button full disabled={!f.name.trim()} onClick={custom}>Add to list</Button>
        </div>
      )}
      {tab === 'template' && (
        <div className="space-y-2">
          {(templates ?? []).length === 0 ? <p className="text-sm text-slate2">No saved templates yet. Save a trip's list as a template from the trip page.</p> :
            templates!.map((t) => (
              <button key={t.id} className="w-full p-3 rounded-xl bg-slate-50 text-left font-semibold active:bg-teal-50" onClick={() => void fromTemplate(t.id)}>{t.name}</button>
            ))}
        </div>
      )}
    </Sheet>
  );
}

/* ---------- edit item ---------- */
function EditSheet({ item, onClose, catNames }: { item: Item | null; onClose: () => void; catNames: string[] }) {
  const [i, setI] = useState<Item | null>(item);
  useEffect(() => setI(item), [item]);
  if (!item || !i) return null;
  const set = (patch: Partial<Item>) => setI({ ...i, ...patch });
  async function save() {
    await updateItem(i!.id, { name: i!.name.trim() || item!.name, category: i!.category, quantity: i!.quantity, priority: i!.priority, notes: i!.notes, bag: i!.bag, pack_when: isLastMinute(i!) ? 'last_minute' : 'any' });
    onClose();
  }
  return (
    <Sheet open onClose={onClose} title="Edit item">
      <div className="space-y-3">
        <Field label="Name"><Input value={i.name} onChange={(e) => set({ name: e.target.value })} /></Field>
        <Field label="Category"><Select value={i.category} onChange={(e) => set({ category: e.target.value })}>{[...new Set([...catNames, i.category])].map((c) => <option key={c}>{c}</option>)}</Select></Field>
        <Field label="Bag"><Select value={i.bag ?? ''} onChange={(e) => set({ bag: e.target.value || null })}><option value="">Not assigned</option>{BAGS.map((b) => <option key={b}>{b}</option>)}</Select></Field>
        <div className="flex items-center gap-4">
          <Stepper value={i.quantity} onChange={(n) => set({ quantity: n })} />
          <Chip active={i.priority === 'essential'} onClick={() => set({ priority: i.priority === 'essential' ? 'optional' : 'essential' })}>Essential</Chip>
          <Chip active={isLastMinute(i)} onClick={() => set({ pack_when: isLastMinute(i) ? 'any' : 'last_minute' })}>Pack on travel morning</Chip>
        </div>
        <Field label="Notes"><Textarea rows={2} value={i.notes} onChange={(e) => set({ notes: e.target.value })} /></Field>
        <div className="flex gap-2">
          <Button variant="secondary" icon="ArrowUp" onClick={() => void moveItem(i.id, -1)} aria-label="Move up" />
          <Button variant="secondary" icon="ArrowDown" onClick={() => void moveItem(i.id, 1)} aria-label="Move down" />
          <Button full onClick={save}>Save</Button>
        </div>
      </div>
    </Sheet>
  );
}

/* ---------- smart generate ---------- */
function GenerateSheet({ open, onClose, tripId, onDone }: { open: boolean; onClose: () => void; tripId: string; onDone: () => void }) {
  const trip = useTrip(tripId);
  const prefs = usePreferences();
  const items = useItems(tripId);
  const { toast } = useUi();
  const gen = useMemo(() => (trip && prefs ? generateForTrip(trip, nightsOf(trip.start_date, trip.end_date), prefs) : null), [trip, prefs]);
  const existing = new Set((items ?? []).map((i) => i.name.toLowerCase()));
  const fresh = (gen?.items ?? []).filter((g) => !existing.has(g.name.toLowerCase()));
  const [skip, setSkip] = useState<Set<string>>(new Set());
  useEffect(() => { if (open) setSkip(new Set()); }, [open]);
  if (!open || !gen || !trip) return null;

  const chosen = fresh.filter((g) => !skip.has(g.name));
  const toggle = (n: string) => setSkip((s) => { const x = new Set(s); if (x.has(n)) x.delete(n); else x.add(n); return x; });

  async function apply() {
    const r = await addItems(tripId, chosen.map((g) => ({ name: g.name, category: g.category, quantity: g.quantity, priority: g.priority, bag: g.bag, source: 'generator' as const, notes: '' })), 'keep');
    toast(`Added ${r.added} items`);
    onDone();
  }
  const byCat = new Map<string, typeof fresh>();
  for (const g of fresh) byCat.set(g.category, [...(byCat.get(g.category) ?? []), g]);

  return (
    <Sheet open onClose={onClose} title="Smart packing list" tall>
      <p className="text-sm text-slate2 mb-3">Built from your trip details{gen.influences.length ? ' and saved preferences' : ''}. Untick anything you don't want.</p>
      {gen.influences.length > 0 && (
        <div className="rounded-xl bg-teal-50 p-3 mb-3 text-sm">
          <p className="font-bold text-teal-600 flex items-center gap-1.5"><Icon name="Brain" size={16} />Travel Memory applied</p>
          <ul className="mt-1 space-y-0.5 text-slate-700">{gen.influences.map((x, k) => <li key={k}>“{x.statement}” → {x.action}: {x.item}</li>)}</ul>
        </div>
      )}
      {fresh.length === 0 ? <p className="text-sm text-slate2 py-6 text-center">Everything suggested is already on your list.</p> :
        [...byCat.entries()].map(([c, list]) => (
          <div key={c} className="mb-3">
            <h3 className="text-xs font-extrabold uppercase tracking-wide text-slate2 mb-1">{c}</h3>
            <ul className="divide-y divide-slate-100 bg-slate-50 rounded-xl">
              {list.map((g) => (
                <li key={g.name}>
                  <label className="flex items-start gap-3 p-3">
                    <input type="checkbox" className="mt-1 h-5 w-5 accent-teal" checked={!skip.has(g.name)} onChange={() => toggle(g.name)} />
                    <span className="flex-1 min-w-0">
                      <span className="font-semibold">{g.name}{g.quantity > 1 ? ` ×${g.quantity}` : ''}</span>
                      <span className="block text-xs text-slate2">{g.reason}</span>
                      {g.influencedBy.map((s) => <span key={s} className="block text-xs text-teal-600 font-semibold">Preference: {s}</span>)}
                    </span>
                  </label>
                </li>
              ))}
            </ul>
          </div>
        ))}
      <div className="sticky bottom-0 bg-white pt-2">
        <Button full disabled={chosen.length === 0} onClick={apply}>Add {chosen.length} item{chosen.length === 1 ? '' : 's'}</Button>
      </div>
    </Sheet>
  );
}
