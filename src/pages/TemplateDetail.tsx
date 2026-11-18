import { useMemo, useState } from 'react';
import { useNavigate, useParams } from 'react-router-dom';
import { Button, Field, Input, Select, Sheet, TopBar, useUi } from '../components/ui';
import { Icon } from '../components/icons';
import { useTemplate, useTemplateItems, useTrips } from '../hooks/data';
import { DEFAULT_TEMPLATES, templateCtx } from '../data/templates';
import { generate } from '../lib/generator';
import { DEFAULT_CATEGORIES, searchCatalog } from '../data/catalog';
import { addItems, addTemplateItem, createTemplate, deleteTemplate, deleteTemplateItem, updateTemplate } from '../db/repo';
import type { Priority } from '../types';

interface Row { id?: string; name: string; category: string; quantity: number; priority: Priority; bag: string | null; notes?: string }

export default function TemplateDetail({ kind }: { kind: 'default' | 'mine' }) {
  const { key } = useParams();
  const nav = useNavigate();
  const { toast, confirm } = useUi();
  const trips = useTrips();
  const def = kind === 'default' ? DEFAULT_TEMPLATES.find((t) => t.id === key) : undefined;
  const mine = useTemplate(kind === 'mine' ? key : undefined);
  const mineItems = useTemplateItems(kind === 'mine' ? key : undefined);
  const [applyOpen, setApplyOpen] = useState(false);
  const [target, setTarget] = useState('');
  const [add, setAdd] = useState('');

  const rows: Row[] = useMemo(() => {
    if (def) return generate(templateCtx(def)).items.map((g) => ({ name: g.name, category: g.category, quantity: g.quantity, priority: g.priority, bag: g.bag }));
    return (mineItems ?? []).map((i) => ({ id: i.id, name: i.name, category: i.category, quantity: i.quantity, priority: i.priority, bag: i.bag, notes: i.notes }));
  }, [def, mineItems]);

  const title = def?.name ?? mine?.name;
  if (kind === 'default' && !def) return <div className="p-6">Template not found.</div>;
  if (kind === 'mine' && mine === undefined) return <div className="p-6 text-slate2">Loading…</div>;
  if (kind === 'mine' && !mine) return <div className="p-6">Template not found.</div>;

  const cats = [...new Set([...DEFAULT_CATEGORIES.map((c) => c.name as string), ...rows.map((r) => r.category)])].filter((c) => rows.some((r) => r.category === c));

  async function apply() {
    if (!target) return;
    const r = await addItems(target, rows.map((x) => ({ name: x.name, category: x.category, quantity: x.quantity, priority: x.priority, bag: x.bag, source: 'template' as const })), 'keep');
    toast(`Added ${r.added} items`);
    setApplyOpen(false);
    nav(`/trips/${target}/packing`);
  }
  async function saveCopy() {
    const t = await createTemplate({ name: `${def!.name} (mine)`, description: def!.blurb, trip_type: def!.type, nights: def!.nights });
    for (const r of rows) await addTemplateItem(t.id, r);
    toast('Saved to My templates');
    nav(`/templates/mine/${t.id}`);
  }
  async function newTrip() {
    nav('/trips/new');
  }
  async function remove() {
    if (!(await confirm({ title: 'Delete this template?', confirmLabel: 'Delete', danger: true }))) return;
    await deleteTemplate(mine!.id);
    nav('/templates');
  }
  async function addOne() {
    const n = add.trim();
    if (!n || !mine) return;
    const hit = searchCatalog(n).find((c) => c.name.toLowerCase() === n.toLowerCase());
    await addTemplateItem(mine.id, { name: hit?.name ?? n, category: hit?.category ?? 'Miscellaneous', priority: hit?.priority ?? 'optional', bag: hit?.bag ?? null });
    setAdd('');
  }
  async function rename() {
    const n = window.prompt('Template name', mine!.name);
    if (n?.trim()) await updateTemplate(mine!.id, { name: n.trim() });
  }

  return (
    <div>
      <TopBar title={title ?? ''} sub={`${rows.length} items`} back="/templates"
        right={mine ? <Button small variant="ghost" icon="Pencil" onClick={rename}>Rename</Button> : undefined} />
      <div className="px-4 pb-32 space-y-3">
        {def && <p className="text-sm text-slate2">{def.blurb}. Items below are generated from the template's typical conditions. They are a starting point, not a fixed list.</p>}
        {mine && (
          <div className="flex gap-2">
            <Input placeholder="Add an item" aria-label="Add template item" value={add} onChange={(e) => setAdd(e.target.value)} onKeyDown={(e) => e.key === 'Enter' && void addOne()} />
            <Button onClick={addOne} disabled={!add.trim()} aria-label="Add">Add</Button>
          </div>
        )}
        {rows.length === 0 && <p className="text-center text-slate2 text-sm py-8">This template is empty.</p>}
        {cats.map((c) => (
          <section key={c} className="bg-white rounded-2xl shadow-card overflow-hidden">
            <h2 className="px-4 py-2.5 bg-slate-50 font-extrabold text-[15px]">{c}</h2>
            <ul className="divide-y divide-slate-100">
              {rows.filter((r) => r.category === c).map((r) => (
                <li key={r.id ?? r.name} className="flex items-center gap-2 px-4 py-2.5 text-sm">
                  {r.priority === 'essential' && <Icon name="Star" size={13} className="text-warn fill-warn" />}
                  <span className="flex-1 font-semibold">{r.name}{r.quantity > 1 ? ` ×${r.quantity}` : ''}</span>
                  {r.id && <button aria-label={`Remove ${r.name}`} className="text-slate-400 h-8 w-8 grid place-items-center" onClick={() => void deleteTemplateItem(r.id!)}><Icon name="X" size={16} /></button>}
                </li>
              ))}
            </ul>
          </section>
        ))}
        {mine && <Button variant="ghost" icon="Trash2" className="!text-danger" onClick={remove}>Delete template</Button>}
      </div>

      <div className="fixed bottom-0 inset-x-0 bg-white/95 backdrop-blur border-t border-slate-200 p-3 safe-b z-30">
        <div className="max-w-2xl mx-auto flex gap-2">
          {def && <Button variant="secondary" onClick={saveCopy}>Save copy</Button>}
          {def && <Button full icon="Plus" onClick={newTrip}>Start a new trip</Button>}
          <Button full={!def} variant={def ? 'secondary' : 'primary'} disabled={rows.length === 0} onClick={() => setApplyOpen(true)}>Apply to a trip</Button>
        </div>
      </div>

      <Sheet open={applyOpen} onClose={() => setApplyOpen(false)} title="Apply to trip">
        {(trips ?? []).length === 0 ? <p className="text-sm text-slate2">Create a trip first.</p> : (
          <div className="space-y-3">
            <Field label="Choose a trip"><Select value={target} onChange={(e) => setTarget(e.target.value)}><option value="">Select…</option>{trips!.map((t) => <option key={t.id} value={t.id}>{t.name}</option>)}</Select></Field>
            <p className="text-xs text-slate2">Items already on the trip are kept as they are.</p>
            <Button full disabled={!target} onClick={apply}>Add {rows.length} items</Button>
          </div>
        )}
      </Sheet>
    </div>
  );
}
