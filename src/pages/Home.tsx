import { Link, useNavigate } from 'react-router-dom';
import { Button, Card, EmptyState, Chip, ProgressBar, TripCover, useUi } from '../components/ui';
import { Icon } from '../components/icons';
import { TripRow } from '../components/TripCard';
import { useAllItems, useDisplayName, useTrips } from '../hooks/data';
import { nextAction, snapshot, urgencyFor, type Urgency } from '../lib/nextAction';
import { fmtRange, greeting, nightsOf, todayStr } from '../lib/util';
import type { Item, Trip } from '../types';
import { addItems, createTrip, setPacked } from '../db/repo';
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
  const ended = trips.filter((t) => t.end_date < today && t.status !== 'completed').sort((a, b) => b.end_date.localeCompare(a.end_date));
  const next = active[0] ?? ended[0];
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
    <div className="px-4 pt-6 pb-2 safe-t">
      <header className="flex items-start justify-between">
        <div>
          <h1 className="text-[22px] font-extrabold leading-tight">{greeting()}{name ? `, ${name}` : ''}!</h1>
          <p className="text-slate2 text-sm">Ready for your next adventure?</p>
        </div>
        <img src={`${import.meta.env.BASE_URL}icons/icon-192.png`} alt="Voyago" className="h-10 w-10 rounded-xl" />
      </header>

      {next ? (
        <Hero trip={next} items={items} today={today} />
      ) : (
        <Card className="mt-6"><EmptyState icon="Luggage" title="No trips yet" body="Create a trip and Voyago will build a packing list that fits it."
          action={<Button icon="Plus" onClick={() => nav('/trips/new')}>Create your first trip</Button>} /></Card>
      )}

      <div className="grid grid-cols-4 gap-2 mt-4">
        {qa.map((q) => (
          <button key={q.label} onClick={q.run} className="bg-white rounded-2xl shadow-card py-3 px-1 flex flex-col items-center gap-1.5 text-[11.5px] font-bold text-center leading-tight active:scale-95 transition">
            <span className="h-10 w-10 rounded-xl bg-teal-50 text-teal grid place-items-center"><Icon name={q.icon} size={20} /></span>
            {q.label}
          </button>
        ))}
      </div>

      {next && <NeedsAttention trip={next} items={items} today={today} />}

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

const CHIP: Record<Urgency, string> = {
  calm: 'bg-white text-navy', done: 'bg-white text-teal-600', muted: 'bg-white/90 text-slate2',
  warn: 'bg-amber-100 text-amber-800', danger: 'bg-red-100 text-danger'
};

function Hero({ trip, items, today }: { trip: Trip; items: Item[]; today: string }) {
  const nav = useNavigate();
  const a = nextAction(trip, items, today);
  const s = snapshot(trip, items, today);
  return (
    <TripCover trip={trip} className="mt-6 rounded-3xl shadow-card">
      <div className="absolute inset-0 bg-gradient-to-t from-navy/90 via-navy/50 to-navy/20" />
      <div className="relative p-6 text-white">
        <div className="flex items-start justify-between gap-4">
          <div className="min-w-0">
            <p className="text-[11px] font-extrabold tracking-widest uppercase text-white/70">{a.eyebrow}</p>
            <button onClick={() => nav(`/trips/${trip.id}`)} className="text-left">
              <h2 className="text-[22px] font-extrabold leading-tight mt-1 line-clamp-2">{trip.name}</h2>
              <p className="text-[13px] text-white/80 mt-1">{fmtRange(trip.start_date, trip.end_date)} · {nightsOf(trip.start_date, trip.end_date)} nights</p>
            </button>
          </div>
          {a.chip && <span className={`text-xs font-extrabold rounded-full px-3 py-1.5 shrink-0 ${CHIP[a.urgency]}`}>{a.chip}</span>}
        </div>

        <div className="mt-6 rounded-2xl bg-white/10 border border-white/15 p-4">
          <p className="text-[17px] font-extrabold leading-snug">{a.headline}</p>
          <p className="text-[13px] text-white/80 mt-1">{a.sub}</p>
          {a.showProgress && (
            <div className="flex items-center gap-3 mt-4">
              <div className="h-2 flex-1 rounded-full bg-white/25 overflow-hidden" role="progressbar" aria-valuenow={s.pct} aria-valuemin={0} aria-valuemax={100} aria-label="Packing progress">
                <div className="h-full rounded-full bg-white transition-all duration-500" style={{ width: `${s.pct}%` }} />
              </div>
              <span className="text-xs font-bold tabular-nums">{s.pct}%</span>
            </div>
          )}
          {a.focus && (
            <button onClick={() => void setPacked(a.focus!.id, true)} aria-label={`Mark ${a.focus.name} as packed`}
              className="mt-4 w-full flex items-center gap-3 rounded-xl bg-white/10 border border-white/15 px-3 py-2.5 text-left active:bg-white/20">
              <span className="h-6 w-6 rounded-lg border-2 border-white/70 shrink-0" aria-hidden="true" />
              <span className="min-w-0 flex-1">
                <span className="block text-[11px] font-extrabold tracking-wider uppercase text-white/60">Next up</span>
                <span className="block text-[14px] font-bold leading-snug line-clamp-2">{a.focus.name}</span>
              </span>
              <span className="text-xs font-bold text-white/70 shrink-0">Tap when packed</span>
            </button>
          )}
        </div>

        <button onClick={() => nav(a.cta.to)} className="mt-4 w-full h-12 rounded-xl bg-white text-navy font-extrabold text-[15px] flex items-center justify-center gap-2 active:scale-[.98] transition">
          {a.cta.label}<Icon name="ChevronRight" size={18} />
        </button>
        {a.secondary && (
          <button onClick={() => nav(a.secondary!.to)} className="mt-2 w-full h-10 text-[13px] font-bold text-white/85 underline underline-offset-4 decoration-white/40 active:opacity-70">
            {a.secondary.label}
          </button>
        )}
      </div>
    </TripCover>
  );
}

const TILE: Record<Urgency, { bar: string; icon: string; count: string; chip: string }> = {
  danger: { bar: 'bg-danger', icon: 'bg-red-50 text-danger', count: 'text-danger', chip: 'Urgent' },
  warn: { bar: 'bg-warn', icon: 'bg-amber-50 text-amber-600', count: 'text-amber-700', chip: 'Soon' },
  calm: { bar: 'bg-teal', icon: 'bg-teal-50 text-teal', count: 'text-navy', chip: '' },
  done: { bar: 'bg-ok', icon: 'bg-teal-50 text-teal', count: 'text-teal-600', chip: 'All set' },
  muted: { bar: 'bg-slate-300', icon: 'bg-slate-100 text-slate2', count: 'text-slate2', chip: '' }
};

function examples(list: Item[]): string {
  if (list.length === 0) return 'Nothing pending';
  const names = list.slice(0, 2).map((i) => i.name);
  return names.join(' · ') + (list.length > 2 ? ` +${list.length - 2} more` : '');
}

function NeedsAttention({ trip, items, today }: { trip: Trip; items: Item[]; today: string }) {
  const nav = useNavigate();
  const s = snapshot(trip, items, today);
  const a = nextAction(trip, items, today);
  if (s.total === 0 || a.state === 'ongoing' || a.state === 'ended' || a.state === 'all-packed') return null;
  const tiles = [
    { key: 'ess', label: 'Essentials left', icon: 'Star', list: s.essentialsLeft, urgency: urgencyFor(s.daysLeft, s.essentialsLeft.length, 'essentials'), to: `/trips/${trip.id}/packing?filter=essential` },
    { key: 'trv', label: 'Travel day items', icon: 'Clock', list: s.travelLeft, urgency: urgencyFor(s.daysLeft, s.travelLeft.length, 'travel'), to: `/trips/${trip.id}/travel-day` }
  ];
  return (
    <section className="mt-6">
      <h2 className="text-[17px] font-extrabold mb-3">Needs attention</h2>
      <div className="grid grid-cols-2 gap-3">
        {tiles.map((t) => {
          const k = TILE[t.urgency];
          return (
            <button key={t.key} onClick={() => nav(t.to)} className="relative overflow-hidden bg-white rounded-2xl shadow-card p-4 text-left active:scale-[.98] transition">
              <span className={`absolute left-0 top-4 bottom-4 w-1 rounded-r-full ${k.bar}`} aria-hidden="true" />
              <div className="flex items-center justify-between">
                <span className={`h-8 w-8 rounded-full grid place-items-center ${k.icon}`}><Icon name={t.urgency === 'done' ? 'Check' : t.icon} size={16} /></span>
                {k.chip && <span className={`text-[11px] font-extrabold ${k.count}`}>{k.chip}</span>}
              </div>
              <p className={`text-[32px] leading-none font-extrabold mt-4 tabular-nums ${k.count}`}>{t.list.length}</p>
              <p className="text-[13px] font-bold mt-1">{t.label}</p>
              <p className="text-xs text-slate2 mt-1 truncate">{examples(t.list)}</p>
            </button>
          );
        })}
      </div>
    </section>
  );
}
