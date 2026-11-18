import { useNavigate, useParams } from 'react-router-dom';
import { Button, Chip, ProgressBar, TopBar, useUi } from '../components/ui';
import { Icon } from '../components/icons';
import { useItems, useTrip } from '../hooks/data';
import { setManyPacked, setPacked, statsOf, updateTrip } from '../db/repo';

export default function Review() {
  const { id } = useParams();
  const trip = useTrip(id);
  const items = useItems(id);
  const nav = useNavigate();
  const { toast } = useUi();
  if (!trip || !items) return <div className="p-6 text-slate2">Loading…</div>;
  const s = statsOf(items);
  const pending = items.filter((i) => !i.packed);
  const ready = s.total > 0 && s.pending === 0;

  async function finish() {
    await updateTrip(trip!.id, { status: 'completed' });
    toast('Trip marked completed');
    nav(`/trips/${trip!.id}`);
  }

  return (
    <div>
      <TopBar title="Final review" sub={trip.name} back={`/trips/${trip.id}`} />
      <div className="px-4 pb-10 space-y-4">
        <div className={`rounded-2xl p-5 ${ready ? 'bg-teal-50' : 'bg-white shadow-card'}`}>
          <div className="flex items-center gap-3">
            <span className={`h-12 w-12 rounded-2xl grid place-items-center ${ready ? 'bg-teal text-white' : 'bg-amber-50 text-amber-600'}`}><Icon name={ready ? 'CheckCircle2' : 'CircleAlert'} size={26} /></span>
            <div>
              <p className="font-extrabold text-lg">{s.total === 0 ? 'No items yet' : ready ? 'All packed. You are ready to go.' : `${s.pending} item${s.pending > 1 ? 's' : ''} left`}</p>
              <p className="text-sm text-slate2">{s.packed} of {s.total} packed</p>
            </div>
          </div>
          <ProgressBar value={s.pct} className="mt-4" />
        </div>

        {s.essentialPending.length > 0 && (
          <section className="bg-white rounded-2xl shadow-card p-4">
            <h2 className="font-extrabold flex items-center gap-2"><Icon name="Star" size={16} className="text-warn fill-warn" />Essentials not packed</h2>
            <ul className="mt-2 divide-y divide-slate-100">
              {s.essentialPending.map((i) => (
                <li key={i.id} className="py-2.5 flex items-center gap-3">
                  <span className="flex-1 font-semibold">{i.name}</span>
                  <Button small variant="secondary" onClick={() => void setPacked(i.id, true)}>Packed</Button>
                </li>
              ))}
            </ul>
          </section>
        )}

        {pending.filter((i) => i.priority !== 'essential').length > 0 && (
          <section className="bg-white rounded-2xl shadow-card p-4">
            <h2 className="font-extrabold">Other pending items</h2>
            <div className="flex flex-wrap gap-2 mt-2">{pending.filter((i) => i.priority !== 'essential').map((i) => <Chip key={i.id} tone="soon">{i.name}</Chip>)}</div>
            <Button small variant="ghost" className="mt-2" onClick={() => void setManyPacked(pending.map((i) => i.id), true)}>Mark all as packed</Button>
          </section>
        )}

        <div className="flex gap-2">
          <Button variant="secondary" full onClick={() => nav(`/trips/${trip.id}/packing`)}>Back to list</Button>
          <Button full icon="Check" onClick={finish}>{ready ? 'Mark trip completed' : 'Complete anyway'}</Button>
        </div>
      </div>
    </div>
  );
}
