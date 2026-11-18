import { useState } from 'react';
import { useParams } from 'react-router-dom';
import { Button, Chip, EmptyState, Field, Input, Select, Sheet, TopBar, Textarea, useUi } from '../components/ui';
import { Icon } from '../components/icons';
import { useItinerary, useTrip } from '../hooks/data';
import { addItinerary, removeRow, restoreRow, updateItinerary } from '../db/modules';
import { fmtDay, tripDays } from '../lib/util';
import type { ItineraryItem } from '../types';

const TAGS = ['Food', 'Nature', 'Heritage', 'Market', 'Viewpoint', 'Experience', 'Spiritual', 'Other'];

export default function Itinerary() {
  const { id } = useParams();
  const trip = useTrip(id);
  const rows = useItinerary(id);
  const { toast } = useUi();
  const [tab, setTab] = useState<'plan' | 'gem'>('plan');
  const [form, setForm] = useState<{ kind: 'plan' | 'gem'; day?: string; edit?: ItineraryItem } | null>(null);
  const [tag, setTag] = useState('All');
  if (!trip || !rows) return <div className="p-6 text-slate2">Loading…</div>;

  const days = tripDays(trip.start_date, trip.end_date);
  const plan = (d: string) => rows.filter((r) => r.day_date === d).sort((a, b) => (a.start_time ?? '99').localeCompare(b.start_time ?? '99') || a.sort_order - b.sort_order);
  const gems = rows.filter((r) => r.kind === 'gem' && (tag === 'All' || r.tag === tag)).sort((a, b) => Number(a.done) - Number(b.done) || a.sort_order - b.sort_order);
  const gemCount = rows.filter((r) => r.kind === 'gem').length;

  async function del(r: ItineraryItem) {
    await removeRow('itinerary', r.id);
    toast(`Removed ${r.title}`, { label: 'Undo', run: () => { void restoreRow('itinerary', r.id); } });
  }

  const Row = ({ r }: { r: ItineraryItem }) => (
    <li className="flex items-start gap-3 px-4 py-3">
      <button role="checkbox" aria-checked={r.done} aria-label={`Done: ${r.title}`} onClick={() => void updateItinerary(r.id, { done: !r.done })}
        className={`mt-0.5 h-6 w-6 rounded-lg border-2 grid place-items-center shrink-0 ${r.done ? 'bg-teal border-teal text-white' : 'border-slate-300'}`}>{r.done && <Icon name="Check" size={14} strokeWidth={3} />}</button>
      <button className="flex-1 min-w-0 text-left" onClick={() => setForm({ kind: r.kind, edit: r })}>
        <p className={`font-semibold ${r.done ? 'line-through text-slate-400' : ''}`}>
          {r.start_time && <span className="text-teal mr-2 text-sm">{r.start_time}</span>}{r.title}
          {r.kind === 'gem' && r.day_date && <span className="ml-2 align-middle"><Chip tone="ok">Hidden gem</Chip></span>}
        </p>
        {(r.location || r.notes) && <p className="text-xs text-slate2 mt-0.5">{[r.location, r.notes].filter(Boolean).join(' · ')}</p>}
      </button>
      <button aria-label={`Remove ${r.title}`} className="text-slate-400 h-8 w-8 grid place-items-center" onClick={() => void del(r)}><Icon name="Trash2" size={16} /></button>
    </li>
  );

  return (
    <div>
      <TopBar title="Itinerary" sub={trip.name} back={`/trips/${trip.id}`} />
      <div className="px-4 pb-28 space-y-3">
        <div className="flex gap-2">
          <Chip active={tab === 'plan'} onClick={() => setTab('plan')}>Day plan</Chip>
          <Chip active={tab === 'gem'} onClick={() => setTab('gem')}>Hidden gems ({gemCount})</Chip>
        </div>

        {tab === 'plan' && days.map((d, i) => (
          <section key={d} className="bg-white rounded-2xl shadow-card overflow-hidden">
            <div className="flex items-center px-4 py-3 bg-slate-50">
              <h2 className="font-extrabold flex-1">Day {i + 1} <span className="text-slate2 font-semibold text-sm ml-1">{fmtDay(d)}</span></h2>
              <button className="text-teal text-sm font-bold flex items-center gap-1" onClick={() => setForm({ kind: 'plan', day: d })}><Icon name="Plus" size={16} />Add</button>
            </div>
            {plan(d).length === 0 ? <p className="px-4 py-3 text-sm text-slate2">Nothing planned.</p> : <ul className="divide-y divide-slate-100">{plan(d).map((r) => <Row key={r.id} r={r} />)}</ul>}
          </section>
        ))}

        {tab === 'gem' && (
          <>
            <p className="text-sm text-slate2">Off-beat spots and local finds to do. Tap one to schedule it on a day.</p>
            <div className="flex gap-2 overflow-x-auto -mx-4 px-4 pb-1">{['All', ...TAGS].map((t) => <Chip key={t} active={tag === t} onClick={() => setTag(t)}>{t}</Chip>)}</div>
            {gems.length === 0 ? (
              <EmptyState icon="Map" title="No hidden gems yet" body="Add cafes, viewpoints, markets or anything off the usual tourist path." action={<Button icon="Plus" onClick={() => setForm({ kind: 'gem' })}>Add a hidden gem</Button>} />
            ) : (
              <section className="bg-white rounded-2xl shadow-card overflow-hidden"><ul className="divide-y divide-slate-100">
                {gems.map((r) => (
                  <li key={r.id} className="flex items-start gap-3 px-4 py-3">
                    <button role="checkbox" aria-checked={r.done} aria-label={`Visited: ${r.title}`} onClick={() => void updateItinerary(r.id, { done: !r.done })}
                      className={`mt-0.5 h-6 w-6 rounded-lg border-2 grid place-items-center shrink-0 ${r.done ? 'bg-teal border-teal text-white' : 'border-slate-300'}`}>{r.done && <Icon name="Check" size={14} strokeWidth={3} />}</button>
                    <button className="flex-1 min-w-0 text-left" onClick={() => setForm({ kind: 'gem', edit: r })}>
                      <p className={`font-semibold ${r.done ? 'line-through text-slate-400' : ''}`}>{r.title}</p>
                      <p className="text-xs text-slate2 mt-0.5">{[r.tag, r.location, r.day_date ? `Planned ${fmtDay(r.day_date)}` : ''].filter(Boolean).join(' · ')}</p>
                      {r.notes && <p className="text-xs text-slate2">{r.notes}</p>}
                    </button>
                    <button aria-label={`Remove ${r.title}`} className="text-slate-400 h-8 w-8 grid place-items-center" onClick={() => void del(r)}><Icon name="Trash2" size={16} /></button>
                  </li>
                ))}
              </ul></section>
            )}
          </>
        )}
      </div>
      {tab === 'gem' && <button aria-label="Add hidden gem" onClick={() => setForm({ kind: 'gem' })} className="fixed right-4 bottom-6 z-30 h-14 w-14 rounded-full bg-teal text-white shadow-lg grid place-items-center safe-b"><Icon name="Plus" size={26} /></button>}
      {form && <ItemForm key={form.edit?.id ?? form.day ?? form.kind} tripId={trip.id} days={days} init={form} onClose={() => setForm(null)} />}
    </div>
  );
}

function ItemForm({ tripId, days, init, onClose }: { tripId: string; days: string[]; init: { kind: 'plan' | 'gem'; day?: string; edit?: ItineraryItem }; onClose: () => void }) {
  const e = init.edit;
  const [f, setF] = useState({ title: e?.title ?? '', time: e?.start_time ?? '', location: e?.location ?? '', notes: e?.notes ?? '', tag: e?.tag || 'Food', day: e?.day_date ?? init.day ?? '' });
  const gem = init.kind === 'gem';
  async function save() {
    if (!f.title.trim()) return;
    const body = { title: f.title.trim(), start_time: f.time || null, location: f.location.trim(), notes: f.notes.trim(), tag: gem ? f.tag : '', day_date: f.day || null };
    if (e) await updateItinerary(e.id, body);
    else await addItinerary({ trip_id: tripId, kind: init.kind, ...body });
    onClose();
  }
  return (
    <Sheet open onClose={onClose} title={e ? 'Edit' : gem ? 'Add hidden gem' : 'Add activity'}>
      <div className="space-y-3">
        <Field label={gem ? 'Place or experience' : 'Activity'}><Input autoFocus value={f.title} onChange={(x) => setF({ ...f, title: x.target.value })} /></Field>
        {gem && <Field label="Type"><Select value={f.tag} onChange={(x) => setF({ ...f, tag: x.target.value })}>{TAGS.map((t) => <option key={t}>{t}</option>)}</Select></Field>}
        <div className="grid grid-cols-2 gap-3">
          <Field label={gem ? 'Plan on day' : 'Day'}><Select value={f.day} onChange={(x) => setF({ ...f, day: x.target.value })}>{gem && <option value="">Not scheduled</option>}{days.map((d, i) => <option key={d} value={d}>Day {i + 1}, {fmtDay(d)}</option>)}</Select></Field>
          <Field label="Time (optional)"><Input type="time" value={f.time} onChange={(x) => setF({ ...f, time: x.target.value })} /></Field>
        </div>
        <Field label="Location"><Input value={f.location} onChange={(x) => setF({ ...f, location: x.target.value })} /></Field>
        <Field label={gem ? 'Why it is worth it' : 'Notes'}><Textarea rows={3} value={f.notes} onChange={(x) => setF({ ...f, notes: x.target.value })} /></Field>
        <Button full disabled={!f.title.trim()} onClick={save}>Save</Button>
      </div>
    </Sheet>
  );
}
