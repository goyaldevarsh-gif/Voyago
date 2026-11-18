import { useState } from 'react';
import { useParams } from 'react-router-dom';
import { Button, Chip, EmptyState, Field, Input, Select, Sheet, TopBar, Textarea, useUi } from '../components/ui';
import { Icon } from '../components/icons';
import { useBookings, useTrip } from '../hooks/data';
import { addBooking, removeRow, restoreRow, updateBooking } from '../db/modules';
import { fmtDay, inr } from '../lib/util';
import type { Booking } from '../types';

const KINDS: Record<string, string> = { flight: 'Plane', train: 'Train', hotel: 'Home', cab: 'Car', activity: 'Ticket', other: 'FileText' };
const KIND_LABEL: Record<string, string> = { flight: 'Flight', train: 'Train', hotel: 'Stay', cab: 'Cab / bus', activity: 'Activity', other: 'Other' };

export default function Bookings() {
  const { id } = useParams();
  const trip = useTrip(id);
  const rows = useBookings(id);
  const { toast } = useUi();
  const [edit, setEdit] = useState<Booking | 'new' | null>(null);
  if (!trip || !rows) return <div className="p-6 text-slate2">Loading…</div>;
  const list = [...rows].sort((a, b) => (a.start_date ?? '9').localeCompare(b.start_date ?? '9') || a.created_at.localeCompare(b.created_at));
  const total = rows.filter((r) => r.status !== 'cancelled').reduce((s, r) => s + (r.amount ?? 0), 0);

  return (
    <div>
      <TopBar title="Bookings" sub={trip.name} back={`/trips/${trip.id}`} right={<Button small variant="ghost" icon="Plus" onClick={() => setEdit('new')}>Add</Button>} />
      <div className="px-4 pb-10 space-y-3">
        {rows.length > 0 && <div className="bg-white rounded-2xl shadow-card p-4 flex justify-between"><span className="font-semibold text-slate2">Total booked</span><span className="font-extrabold">{inr(total)}</span></div>}
        {list.length === 0 ? <EmptyState icon="Ticket" title="No bookings yet" body="Keep flight, train, stay and cab details with their reference numbers in one place." action={<Button icon="Plus" onClick={() => setEdit('new')}>Add booking</Button>} /> :
          list.map((b) => (
            <button key={b.id} onClick={() => setEdit(b)} className="w-full text-left bg-white rounded-2xl shadow-card p-4 flex gap-3 items-start">
              <span className="h-11 w-11 rounded-xl bg-teal-50 text-teal grid place-items-center shrink-0"><Icon name={KINDS[b.kind] ?? 'FileText'} size={20} /></span>
              <div className="flex-1 min-w-0">
                <p className="font-extrabold truncate">{b.title}</p>
                <p className="text-xs text-slate2">{[b.provider, b.start_date ? fmtDay(b.start_date) + (b.end_date && b.end_date !== b.start_date ? ' to ' + fmtDay(b.end_date) : '') : ''].filter(Boolean).join(' · ')}</p>
                {b.reference && <p className="text-sm font-bold mt-1 tracking-wide">Ref: {b.reference}</p>}
              </div>
              <div className="text-right shrink-0">{b.amount != null && <p className="font-bold">{inr(b.amount)}</p>}<Chip tone={b.status === 'confirmed' ? 'ok' : b.status === 'pending' ? 'warn' : 'danger'}>{b.status}</Chip></div>
            </button>
          ))}
      </div>
      {edit && <Form key={edit === 'new' ? 'new' : edit.id} init={edit === 'new' ? null : edit} tripId={trip.id} onClose={() => setEdit(null)}
        onDelete={async (b) => { await removeRow('bookings', b.id); setEdit(null); toast('Booking removed', { label: 'Undo', run: () => { void restoreRow('bookings', b.id); } }); }} />}
    </div>
  );
}

function Form({ init, tripId, onClose, onDelete }: { init: Booking | null; tripId: string; onClose: () => void; onDelete: (b: Booking) => void }) {
  const [f, setF] = useState({ kind: init?.kind ?? 'flight', title: init?.title ?? '', provider: init?.provider ?? '', reference: init?.reference ?? '', start: init?.start_date ?? '', end: init?.end_date ?? '', amount: init?.amount != null ? String(init.amount) : '', status: init?.status ?? 'confirmed', notes: init?.notes ?? '' });
  async function save() {
    if (!f.title.trim()) return;
    const body = { kind: f.kind, title: f.title.trim(), provider: f.provider, reference: f.reference, start_date: f.start || null, end_date: f.end || null, amount: f.amount ? Number(f.amount) : null, status: f.status as Booking['status'], notes: f.notes };
    if (init) await updateBooking(init.id, body); else await addBooking({ trip_id: tripId, ...body });
    onClose();
  }
  return (
    <Sheet open onClose={onClose} title={init ? 'Edit booking' : 'Add booking'} tall>
      <div className="space-y-3">
        <Field label="Type"><Select value={f.kind} onChange={(e) => setF({ ...f, kind: e.target.value })}>{Object.entries(KIND_LABEL).map(([k, v]) => <option key={k} value={k}>{v}</option>)}</Select></Field>
        <Field label="Title"><Input value={f.title} onChange={(e) => setF({ ...f, title: e.target.value })} placeholder="Jaipur to Delhi train" /></Field>
        <Field label="Provider (optional)"><Input value={f.provider} onChange={(e) => setF({ ...f, provider: e.target.value })} /></Field>
        <Field label="Booking reference / PNR"><Input value={f.reference} onChange={(e) => setF({ ...f, reference: e.target.value })} /></Field>
        <div className="grid grid-cols-2 gap-3">
          <Field label="From"><Input type="date" value={f.start} onChange={(e) => setF({ ...f, start: e.target.value })} /></Field>
          <Field label="To"><Input type="date" value={f.end} onChange={(e) => setF({ ...f, end: e.target.value })} /></Field>
        </div>
        <div className="grid grid-cols-2 gap-3">
          <Field label="Amount (₹)"><Input type="number" inputMode="decimal" min={0} value={f.amount} onChange={(e) => setF({ ...f, amount: e.target.value })} /></Field>
          <Field label="Status"><Select value={f.status} onChange={(e) => setF({ ...f, status: e.target.value as Booking['status'] })}><option>confirmed</option><option>pending</option><option>cancelled</option></Select></Field>
        </div>
        <Field label="Notes"><Textarea rows={2} value={f.notes} onChange={(e) => setF({ ...f, notes: e.target.value })} /></Field>
        <Button full disabled={!f.title.trim()} onClick={save}>Save</Button>
        {init && <Button full variant="ghost" icon="Trash2" className="!text-danger" onClick={() => onDelete(init)}>Delete</Button>}
      </div>
    </Sheet>
  );
}
