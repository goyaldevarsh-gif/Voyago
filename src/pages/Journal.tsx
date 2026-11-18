import { useRef, useState } from 'react';
import { useParams } from 'react-router-dom';
import { Button, EmptyState, Field, Input, Sheet, TopBar, Textarea, useUi } from '../components/ui';
import { Icon } from '../components/icons';
import { useJournal, useTrip } from '../hooks/data';
import { addJournal, removeRow, restoreRow, updateJournal } from '../db/modules';
import { resizeToDataUrl } from '../lib/image';
import { fmtDay, todayStr } from '../lib/util';
import type { JournalEntry } from '../types';

export default function Journal() {
  const { id } = useParams();
  const trip = useTrip(id);
  const rows = useJournal(id);
  const { toast } = useUi();
  const [edit, setEdit] = useState<JournalEntry | 'new' | null>(null);
  if (!trip || !rows) return <div className="p-6 text-slate2">Loading…</div>;
  const list = [...rows].sort((a, b) => (b.entry_date ?? '').localeCompare(a.entry_date ?? '') || b.created_at.localeCompare(a.created_at));
  return (
    <div>
      <TopBar title="Travel journal" sub={trip.name} back={`/trips/${trip.id}`} right={<Button small variant="ghost" icon="Plus" onClick={() => setEdit('new')}>Write</Button>} />
      <div className="px-4 pb-10 space-y-3">
        {list.length === 0 ? <EmptyState icon="BookOpen" title="Your journal is empty" body="Jot down moments, places and photos from the trip." action={<Button icon="Plus" onClick={() => setEdit('new')}>Write an entry</Button>} /> :
          list.map((j) => (
            <article key={j.id} className="bg-white rounded-2xl shadow-card overflow-hidden">
              {j.photo && <img src={j.photo} alt={j.place || 'Journal photo'} className="w-full max-h-64 object-cover" />}
              <div className="p-4">
                <div className="flex items-start gap-2">
                  <div className="flex-1"><p className="text-xs font-bold text-teal">{[fmtDay(j.entry_date), j.place].filter(Boolean).join(' · ')}</p></div>
                  <button aria-label="Edit entry" onClick={() => setEdit(j)} className="h-8 w-8 grid place-items-center text-slate2"><Icon name="Pencil" size={16} /></button>
                  <button aria-label="Remove entry" className="h-8 w-8 grid place-items-center text-slate-400" onClick={async () => { await removeRow('journal', j.id); toast('Entry removed', { label: 'Undo', run: () => { void restoreRow('journal', j.id); } }); }}><Icon name="Trash2" size={16} /></button>
                </div>
                <p className="mt-1 whitespace-pre-wrap">{j.body}</p>
              </div>
            </article>
          ))}
      </div>
      {edit && <Form key={edit === 'new' ? 'n' : edit.id} init={edit === 'new' ? null : edit} tripId={trip.id} onClose={() => setEdit(null)} />}
    </div>
  );
}

function Form({ init, tripId, onClose }: { init: JournalEntry | null; tripId: string; onClose: () => void }) {
  const [f, setF] = useState({ body: init?.body ?? '', place: init?.place ?? '', date: init?.entry_date ?? todayStr(), photo: init?.photo ?? null as string | null });
  const file = useRef<HTMLInputElement>(null);
  async function pick(e: React.ChangeEvent<HTMLInputElement>) {
    const x = e.target.files?.[0];
    if (x) setF({ ...f, photo: await resizeToDataUrl(x, 1000, 0.75) });
  }
  async function save() {
    if (!f.body.trim() && !f.photo) return;
    const body = { body: f.body.trim(), place: f.place.trim(), entry_date: f.date || null, photo: f.photo };
    if (init) await updateJournal(init.id, body); else await addJournal({ trip_id: tripId, ...body });
    onClose();
  }
  return (
    <Sheet open onClose={onClose} title={init ? 'Edit entry' : 'New entry'} tall>
      <div className="space-y-3">
        <div className="grid grid-cols-2 gap-3">
          <Field label="Date"><Input type="date" value={f.date} onChange={(e) => setF({ ...f, date: e.target.value })} /></Field>
          <Field label="Place"><Input value={f.place} onChange={(e) => setF({ ...f, place: e.target.value })} /></Field>
        </div>
        <Field label="What happened"><Textarea autoFocus rows={6} value={f.body} onChange={(e) => setF({ ...f, body: e.target.value })} /></Field>
        {f.photo && <img src={f.photo} alt="Selected" className="rounded-xl max-h-48 w-full object-cover" />}
        <div className="flex gap-2">
          <Button variant="secondary" icon="Camera" onClick={() => file.current?.click()}>{f.photo ? 'Change photo' : 'Add photo'}</Button>
          {f.photo && <Button variant="ghost" onClick={() => setF({ ...f, photo: null })}>Remove</Button>}
          <input ref={file} type="file" accept="image/*" className="hidden" aria-label="Journal photo" onChange={pick} />
        </div>
        <Button full disabled={!f.body.trim() && !f.photo} onClick={save}>Save</Button>
      </div>
    </Sheet>
  );
}
