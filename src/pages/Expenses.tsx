import { useState } from 'react';
import { useParams } from 'react-router-dom';
import { Button, EmptyState, Field, Input, ProgressBar, Select, Sheet, TopBar, useUi } from '../components/ui';
import { Icon } from '../components/icons';
import { useExpenses, useTrip } from '../hooks/data';
import { addExpense, removeRow, restoreRow, updateExpense } from '../db/modules';
import { updateTrip } from '../db/repo';
import { fmtDay, inr, todayStr } from '../lib/util';
import type { Expense } from '../types';

const CATS = ['Food', 'Stay', 'Transport', 'Fuel / Toll', 'Course / Tickets', 'Shopping', 'Medical', 'Other'];

export default function Expenses() {
  const { id } = useParams();
  const trip = useTrip(id);
  const rows = useExpenses(id);
  const { toast } = useUi();
  const [edit, setEdit] = useState<Expense | 'new' | null>(null);
  const [budgetOpen, setBudgetOpen] = useState(false);
  if (!trip || !rows) return <div className="p-6 text-slate2">Loading…</div>;

  const total = rows.reduce((s, r) => s + r.amount, 0);
  const budget = trip.budget ?? 0;
  const list = [...rows].sort((a, b) => (b.spent_on ?? '').localeCompare(a.spent_on ?? '') || b.created_at.localeCompare(a.created_at));
  const byCat = CATS.map((c) => ({ c, v: rows.filter((r) => r.category === c).reduce((s, r) => s + r.amount, 0) })).filter((x) => x.v > 0).sort((a, b) => b.v - a.v);
  const per = trip.travellers_count > 1 ? total / trip.travellers_count : 0;

  return (
    <div>
      <TopBar title="Expenses" sub={trip.name} back={`/trips/${trip.id}`} right={<Button small variant="ghost" icon="Plus" onClick={() => setEdit('new')}>Add</Button>} />
      <div className="px-4 pb-10 space-y-3">
        <div className="bg-white rounded-2xl shadow-card p-4">
          <div className="flex items-end justify-between">
            <div><p className="text-xs font-semibold text-slate2">Total spent</p><p className="text-3xl font-extrabold">{inr(total)}</p></div>
            <button className="text-teal text-sm font-bold" onClick={() => setBudgetOpen(true)}>{budget ? `Budget ${inr(budget)}` : 'Set budget'}</button>
          </div>
          {budget > 0 && (<><ProgressBar value={Math.min(100, Math.round((total / budget) * 100))} tone={total > budget ? 'warn' : 'teal'} className="mt-3" />
            <p className={`text-xs font-semibold mt-1.5 ${total > budget ? 'text-danger' : 'text-slate2'}`}>{total > budget ? `${inr(total - budget)} over budget` : `${inr(budget - total)} left`}</p></>)}
          {per > 0 && <p className="text-xs text-slate2 mt-2">About {inr(per)} per person for {trip.travellers_count} people (equal split)</p>}
        </div>

        {byCat.length > 0 && (
          <div className="bg-white rounded-2xl shadow-card p-4 space-y-2.5">
            <h2 className="font-extrabold text-sm">By category</h2>
            {byCat.map((x) => (
              <div key={x.c}><div className="flex justify-between text-sm font-semibold"><span>{x.c}</span><span>{inr(x.v)}</span></div><ProgressBar value={Math.round((x.v / total) * 100)} className="mt-1" /></div>
            ))}
          </div>
        )}

        {list.length === 0 ? <EmptyState icon="Wallet" title="No expenses yet" body="Log spending as you go. It works offline and syncs later." action={<Button icon="Plus" onClick={() => setEdit('new')}>Add expense</Button>} /> :
          <section className="bg-white rounded-2xl shadow-card"><ul className="divide-y divide-slate-100">
            {list.map((e) => (
              <li key={e.id} className="flex items-center gap-3 px-4 py-3">
                <button className="flex-1 min-w-0 text-left" onClick={() => setEdit(e)}>
                  <p className="font-semibold">{e.note || e.category}</p>
                  <p className="text-xs text-slate2">{[e.category, e.spent_on ? fmtDay(e.spent_on) : '', e.paid_by && `paid by ${e.paid_by}`].filter(Boolean).join(' · ')}</p>
                </button>
                <span className="font-extrabold">{inr(e.amount)}</span>
                <button aria-label="Remove expense" className="text-slate-400 h-8 w-8 grid place-items-center" onClick={async () => { await removeRow('expenses', e.id); toast('Expense removed', { label: 'Undo', run: () => { void restoreRow('expenses', e.id); } }); }}><Icon name="Trash2" size={16} /></button>
              </li>
            ))}
          </ul></section>}
      </div>
      {edit && <Form key={edit === 'new' ? 'n' : edit.id} init={edit === 'new' ? null : edit} tripId={trip.id} onClose={() => setEdit(null)} />}
      {budgetOpen && <BudgetForm cur={budget} onClose={() => setBudgetOpen(false)} onSave={async (n) => { await updateTrip(trip.id, { budget: n }); setBudgetOpen(false); }} />}
    </div>
  );
}

function Form({ init, tripId, onClose }: { init: Expense | null; tripId: string; onClose: () => void }) {
  const [f, setF] = useState({ amount: init ? String(init.amount) : '', category: init?.category ?? 'Food', note: init?.note ?? '', date: init?.spent_on ?? todayStr(), paid: init?.paid_by ?? '' });
  async function save() {
    const amount = Number(f.amount);
    if (!(amount > 0)) return;
    const body = { category: f.category, amount, note: f.note, spent_on: f.date || null, paid_by: f.paid };
    if (init) await updateExpense(init.id, body); else await addExpense({ trip_id: tripId, ...body });
    onClose();
  }
  return (
    <Sheet open onClose={onClose} title={init ? 'Edit expense' : 'Add expense'}>
      <div className="space-y-3">
        <Field label="Amount (₹)"><Input autoFocus type="number" inputMode="decimal" min={0} value={f.amount} onChange={(e) => setF({ ...f, amount: e.target.value })} /></Field>
        <Field label="Category"><Select value={f.category} onChange={(e) => setF({ ...f, category: e.target.value })}>{CATS.map((c) => <option key={c}>{c}</option>)}</Select></Field>
        <Field label="What for (optional)"><Input value={f.note} onChange={(e) => setF({ ...f, note: e.target.value })} /></Field>
        <div className="grid grid-cols-2 gap-3">
          <Field label="Date"><Input type="date" value={f.date} onChange={(e) => setF({ ...f, date: e.target.value })} /></Field>
          <Field label="Paid by (optional)"><Input value={f.paid} onChange={(e) => setF({ ...f, paid: e.target.value })} /></Field>
        </div>
        <Button full disabled={!(Number(f.amount) > 0)} onClick={save}>Save</Button>
      </div>
    </Sheet>
  );
}

function BudgetForm({ cur, onClose, onSave }: { cur: number; onClose: () => void; onSave: (n: number | null) => void }) {
  const [v, setV] = useState(cur ? String(cur) : '');
  return (
    <Sheet open onClose={onClose} title="Trip budget">
      <div className="space-y-3">
        <Field label="Budget (₹)"><Input autoFocus type="number" inputMode="decimal" min={0} value={v} onChange={(e) => setV(e.target.value)} /></Field>
        <Button full onClick={() => onSave(Number(v) > 0 ? Number(v) : null)}>Save</Button>
      </div>
    </Sheet>
  );
}
