import { Link, useNavigate } from 'react-router-dom';
import { Button, Card, EmptyState, Chip, ProgressBar, TripCover, useUi } from '../components/ui';
import { Icon } from '../components/icons';
import { TripRow, tripProgress } from '../components/TripCard';
import { useAllItems, useDisplayName, useTrips } from '../hooks/data';
import { isLastMinute } from '../lib/lastMinute';
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
        <TripCover trip={next} className="mt-5 rounded-3xl shadow-card">
          <div className="absolute inset-0 bg-gradient-to-t from-navy/90 via-navy/40 to-navy/10" />
          <div className="relative p-5 text-white">
            <Link to={`/trips/${next.id}`} className="block">
              <div className="flex items-start justify-between gap-3">
                <div className="min-w-0">
                  <p className="text-[11px] font-extrabold tracking-widest uppercase text-white/70">Next trip</p>
                  <h2 className="text-2xl font-extrabold leading-tight mt-0.5 line-clamp-2">{next.name}</h2>
                  <p className="text-sm text-white/85 mt-1">{fmtRange(next.start_date, next.end_date)} · {nightsOf(next.start_date, next.end_date)} nights</p>
                </div>
                <span className="bg-white text-navy text-xs font-extrabold rounded-full px-3 py-1.5 shrink-0">{countdown(next.start_date).label}</span>
              </div>
              <PackingMini trip={next.id} items={items} />
            </Link>
            <div className="grid grid-cols-2 gap-2.5 mt-4">
              <button onClick={() => nav(`/trips/${next.id}/packing`)} className="h-11 rounded-xl bg-white text-navy font-bold text-[15px] active:scale-[.98]">
                {tripProgress(items, next.id).total === 0 ? 'Start packing' : 'Continue packing'}
              </button>
              <button onClick={() => nav(`/trips/${next.id}/travel-day`)} className="h-11 rounded-xl bg-white/15 text-white font-bold text-[15px] border border-white/30 active:scale-[.98]">Travel day</button>
            </div>
          </div>
        </TripCover>
      ) : (
        <Card className="mt-5"><EmptyState icon="Luggage" title="No trips yet" body="Create a trip and Voyago will build a packing list that fits it."
          action={<Button icon="Plus" onClick={() => nav('/trips/new')}>Create your first trip</Button>} /></Card>
      )}

      <div className="grid grid-cols-4 gap-2.5 mt-4">
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
  const nav = useNavigate();
  if (!items) return null;
  const mine = items.filter((i) => i.trip_id === tripId);
  const pending = mine.filter((i) => !i.packed);
  if (mine.length === 0 || pending.length === 0) return null;
  const essential = pending.filter((i) => i.priority === 'essential');
  const morning = pending.filter((i) => isLastMinute(i));
  const tiles = [
    { n: essential.length, label: 'Essentials left', icon: 'Star', to: `/trips/${tripId}/packing`, tone: 'text-warn' },
    { n: morning.length, label: 'Morning of travel', icon: 'Clock', to: `/trips/${tripId}/travel-day`, tone: 'text-teal' },
    { n: pending.length, label: 'Total pending', icon: 'ListChecks', to: `/trips/${tripId}/packing`, tone: 'text-slate2' }
  ];
  return (
    <section className="mt-5">
      <h2 className="font-extrabold mb-2">Needs attention</h2>
      <div className="grid grid-cols-3 gap-2.5">
        {tiles.map((t) => (
          <button key={t.label} onClick={() => nav(t.to)} className="bg-white rounded-2xl shadow-card p-3 text-left active:scale-[.98]">
            <Icon name={t.icon} size={18} className={t.tone} />
            <p className="text-2xl font-extrabold mt-2 leading-none">{t.n}</p>
            <p className="text-[11.5px] text-slate2 font-semibold mt-1 leading-tight">{t.label}</p>
          </button>
        ))}
      </div>
    </section>
  );
}
