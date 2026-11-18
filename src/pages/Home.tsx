import { Link, useNavigate } from 'react-router-dom';
import { Button, Card, EmptyState, Chip, ProgressBar, TripCover, useUi } from '../components/ui';
import { Icon } from '../components/icons';
import { TripRow, tripProgress } from '../components/TripCard';
import { useAllItems, useDisplayName, useTrips } from '../hooks/data';
import { countdown, fmtRange, greeting, nightsOf, todayStr } from '../lib/util';
import { addItems, createTrip } from '../db/repo';
import { generate } from '../lib/generator';
import { buildCtx } from '../data/catalog';
import { db } from '../db/local';

export default function Home() {
  const trips = useTrips();
  const items = useAllItems();
  const [name] = useDisplayName();
  const nav = useNavigate();
  const { toast } = useUi();

  if (!trips || !items) return <div className="p-6 text-slate2">Loading…</div>;

  const today = todayStr();
  const active = trips.filter((t) => t.end_date >= today && t.status !== 'completed');
  const next = active[0];
  const others = trips.filter((t) => t.id !== next?.id).sort((a, b) => b.start_date.localeCompare(a.start_date)).slice(0, 3);

  async function quickChecklist() {
    const t = await createTrip({
      name: 'Quick checklist', destination: '', start_date: today, end_date: today, travellers_count: 1, traveller_type: 'solo',
      trip_type: 'other', travel_mode: 'other', accommodation: '', notes: '', international: false
    });
    const prefs = await db.preferences.toArray();
    const g = generate(buildCtx({ nights: 0, type: 'other', mode: 'other', travellers: 1 }), prefs);
    await addItems(t.id, g.items.filter((i) => i.priority === 'essential').map((i) => ({ name: i.name, category: i.category, quantity: i.quantity, priority: i.priority, bag: i.bag, source: 'generator' as const })));
    toast('Quick checklist ready');
    nav(`/trips/${t.id}/packing`);
  }

  const qa = [
    { icon: 'Luggage', label: 'Create Trip', run: () => nav('/trips/new') },
    { icon: 'ListChecks', label: 'Quick Checklist', run: quickChecklist },
    { icon: 'LayoutTemplate', label: 'Templates', run: () => nav('/templates') },
    { icon: 'Sparkles', label: 'Ask Voyago AI', run: () => nav('/chat') }
  ];

  return (
    <div className="px-4 pt-6 safe-t">
      <header className="flex items-start justify-between">
        <div>
          <h1 className="text-[22px] font-extrabold leading-tight">{greeting()}{name ? `, ${name}` : ''}!</h1>
          <p className="text-slate2 text-sm">Ready for your next adventure?</p>
        </div>
        <img src={`${import.meta.env.BASE_URL}icons/icon-192.png`} alt="Voyago" className="h-10 w-10 rounded-xl" />
      </header>

      {next ? (
        <Link to={`/trips/${next.id}`} className="block mt-5">
          <TripCover trip={next} className="rounded-3xl h-56 shadow-card">
            <div className="absolute inset-0 bg-gradient-to-t from-navy/85 via-navy/25 to-transparent" />
            <div className="absolute inset-x-0 bottom-0 p-4 text-white">
              <div className="flex items-end justify-between gap-2">
                <div className="min-w-0">
                  <h2 className="text-2xl font-extrabold leading-tight line-clamp-2">{next.name}</h2>
                  <p className="text-sm text-white/85">{fmtRange(next.start_date, next.end_date)}</p>
                </div>
                <span className="bg-white/90 text-navy text-xs font-extrabold rounded-full px-3 py-1 shrink-0">{countdown(next.start_date).label}</span>
              </div>
              <PackingMini trip={next.id} items={items} />
            </div>
          </TripCover>
        </Link>
      ) : (
        <Card className="mt-5"><EmptyState icon="Luggage" title="No trips yet" body="Create a trip and Voyago will build a packing list that fits it."
          action={<Button icon="Plus" onClick={() => nav('/trips/new')}>Create your first trip</Button>} /></Card>
      )}

      {next && (
        <Button full icon="ChevronRight" className="mt-3" onClick={() => nav(`/trips/${next.id}/packing`)}>
          {tripProgress(items, next.id).total === 0 ? 'Start Packing' : 'Continue Packing'}
        </Button>
      )}

      <div className="grid grid-cols-4 gap-2.5 mt-5">
        {qa.map((q) => (
          <button key={q.label} onClick={q.run} className="bg-white rounded-2xl shadow-card py-3 px-1 flex flex-col items-center gap-1.5 text-[11.5px] font-bold text-center leading-tight active:scale-95 transition">
            <span className="h-10 w-10 rounded-xl bg-teal-50 text-teal grid place-items-center"><Icon name={q.icon} size={20} /></span>
            {q.label}
          </button>
        ))}
      </div>

      {next && <PendingPreview tripId={next.id} />}

      {others.length > 0 && (
        <section className="mt-6">
          <div className="flex items-center justify-between mb-2">
            <h2 className="font-extrabold">{active.length > 1 ? 'Upcoming & recent trips' : 'Recent trips'}</h2>
            <Link to="/trips" className="text-teal text-sm font-bold">View all</Link>
          </div>
          <div className="space-y-2.5">{others.map((t) => <TripRow key={t.id} trip={t} items={items} />)}</div>
        </section>
      )}
    </div>
  );
}

function PackingMini({ trip, items }: { trip: string; items: ReturnType<typeof useAllItems> & object }) {
  const p = tripProgress(items, trip);
  return (
    <div className="mt-3">
      <div className="flex justify-between text-xs font-semibold mb-1"><span>Packing progress</span><span>{p.pct}%</span></div>
      <div className="h-2 rounded-full bg-white/30 overflow-hidden"><div className="h-full bg-white rounded-full" style={{ width: `${p.pct}%` }} /></div>
    </div>
  );
}

function PendingPreview({ tripId }: { tripId: string }) {
  const items = useAllItems();
  if (!items) return null;
  const pending = items.filter((i) => i.trip_id === tripId && !i.packed);
  if (pending.length === 0) return null;
  const essential = pending.filter((i) => i.priority === 'essential');
  const show = (essential.length ? essential : pending).slice(0, 4);
  return (
    <Card className="mt-5 p-4">
      <div className="flex items-center justify-between">
        <h2 className="font-extrabold">Still to pack</h2>
        <Chip tone={essential.length ? 'warn' : 'soon'}>{pending.length} pending{essential.length ? `, ${essential.length} essential` : ''}</Chip>
      </div>
      <ul className="mt-2 divide-y divide-slate-100">
        {show.map((i) => (
          <li key={i.id} className="py-2 flex items-center gap-2 text-sm">
            {i.priority === 'essential' && <Icon name="Star" size={14} className="text-warn fill-warn" />}
            <span className="font-semibold flex-1 truncate">{i.name}</span>
            <span className="text-slate2 text-xs">{i.category}</span>
          </li>
        ))}
      </ul>
    </Card>
  );
}
