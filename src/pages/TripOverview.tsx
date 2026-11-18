import { Link, useNavigate, useParams } from 'react-router-dom';
import { Card, Chip, IconButton, Ring, TripCover, useUi, Button } from '../components/ui';
import { Icon } from '../components/icons';
import { useItems, useTrip } from '../hooks/data';
import { countdown, fmtRange, nightsOf } from '../lib/util';
import { deleteTrip, restoreTrip, statsOf, templateFromTrip, updateTrip, createTrip, copyTripItems } from '../db/repo';

const SOON = [
  { icon: 'FileText', label: 'Documents', sub: 'Tickets, IDs, bookings' },
  { icon: 'Map', label: 'Itinerary', sub: 'Day-wise plan' },
  { icon: 'Wallet', label: 'Bookings', sub: 'Flights, hotels' },
  { icon: 'Wallet', label: 'Expenses', sub: 'Budget and spending' },
  { icon: 'BookOpen', label: 'Travel Journal', sub: 'Photos and notes' }
];

export default function TripOverview() {
  const { id } = useParams();
  const trip = useTrip(id);
  const items = useItems(id);
  const nav = useNavigate();
  const { confirm, toast } = useUi();
  if (trip === undefined || !items) return <div className="p-6 text-slate2">Loading…</div>;
  if (!trip) return <div className="p-6"><p className="font-bold">Trip not found.</p><Link className="text-teal font-bold" to="/trips">Back to trips</Link></div>;

  const s = statsOf(items);
  const c = countdown(trip.start_date);
  const modules = [
    { icon: 'ListChecks', label: 'Packing List', sub: `${s.pct}% complete`, to: `/trips/${trip.id}/packing`, tone: 'bg-teal-50 text-teal' },
    { icon: 'LayoutTemplate', label: 'Packing Templates', sub: 'Apply or save one', to: '/templates', tone: 'bg-sky-50 text-sky-600' },
    { icon: 'FileText', label: 'Trip Notes', sub: trip.notes ? 'Has notes' : 'Add notes', to: `/trips/${trip.id}/notes`, tone: 'bg-amber-50 text-amber-600' },
    { icon: 'ShieldCheck', label: 'Final Review', sub: s.essentialPending.length ? `${s.essentialPending.length} essentials pending` : 'Check before you go', to: `/trips/${trip.id}/review`, tone: 'bg-indigo-50 text-indigo-600' }
  ];

  async function remove() {
    const ok = await confirm({ title: 'Delete this trip?', body: 'The trip and its packing list will be removed.', confirmLabel: 'Delete trip', danger: true });
    if (!ok) return;
    await deleteTrip(trip!.id);
    nav('/trips');
    toast('Trip deleted', { label: 'Undo', run: () => { void restoreTrip(trip!.id); } });
  }
  async function saveTpl() {
    const name = window.prompt('Template name', `${trip!.name} list`);
    if (!name?.trim()) return;
    const t = await templateFromTrip(trip!.id, name.trim());
    toast('Saved as template', { label: 'Open', run: () => nav(`/templates/mine/${t.id}`) });
  }
  async function duplicate() {
    const t = await createTrip({
      name: `${trip!.name} (copy)`, destination: trip!.destination, start_date: trip!.start_date, end_date: trip!.end_date,
      travellers_count: trip!.travellers_count, traveller_type: trip!.traveller_type, trip_type: trip!.trip_type,
      travel_mode: trip!.travel_mode, accommodation: trip!.accommodation, notes: trip!.notes, international: trip!.international,
      cover_image: trip!.cover_image, weather: trip!.weather
    });
    await copyTripItems(trip!.id, t.id, true);
    nav(`/trips/${t.id}`);
    toast('Trip duplicated');
  }
  async function toggleDone() {
    await updateTrip(trip!.id, { status: trip!.status === 'completed' ? 'planning' : 'completed' });
    toast(trip!.status === 'completed' ? 'Trip reopened' : 'Trip marked completed');
  }

  return (
    <div>
      <TripCover trip={trip} className="h-56 rounded-b-3xl safe-t">
        <div className="absolute inset-x-0 top-0 flex justify-between p-3 safe-t">
          <IconButton icon="ChevronLeft" label="Back" onClick={() => nav('/trips')} className="bg-white/90" />
          <IconButton icon="Pencil" label="Edit trip" onClick={() => nav(`/trips/${trip.id}/edit`)} className="bg-white/90" />
        </div>
      </TripCover>

      <div className="px-4 -mt-10 relative">
        <Card className="p-4">
          <div className="flex items-start justify-between gap-2">
            <div className="min-w-0">
              <h1 className="text-xl font-extrabold truncate">{trip.name}</h1>
              <p className="text-sm text-slate2">{fmtRange(trip.start_date, trip.end_date)}</p>
              {trip.destination && <p className="text-xs text-slate2 mt-0.5 flex items-center gap-1"><Icon name="MapPin" size={12} />{trip.destination}</p>}
            </div>
            {trip.status === 'completed' ? <Chip tone="soon">Completed</Chip> : c.days >= 0 ? <Chip tone="ok">{c.label}</Chip> : <Chip tone="soon">Past</Chip>}
          </div>
          <div className="flex items-center gap-4 mt-4">
            <Ring value={s.pct} />
            <div className="flex-1 text-sm">
              <p className="font-extrabold">Packing progress</p>
              <p className="text-slate2">{s.packed} of {s.total} items packed</p>
              <div className="flex gap-4 mt-2 text-xs font-semibold text-slate2">
                <span className="flex items-center gap-1"><Icon name="Clock" size={13} />{nightsOf(trip.start_date, trip.end_date)} nights</span>
                <span className="flex items-center gap-1"><Icon name="Users" size={13} />{trip.travellers_count}</span>
                <span className="capitalize">{trip.trip_type}</span>
              </div>
            </div>
          </div>
          {trip.weather && <p className="text-xs text-slate2 mt-3 flex items-center gap-1.5"><Icon name="CloudSun" size={14} className="text-teal" />{trip.weather.min_c}° to {trip.weather.max_c}°C, rain on {trip.weather.rain_pct}% of days</p>}
        </Card>

        <div className="grid grid-cols-2 gap-3 mt-4">
          {modules.map((m) => (
            <Link key={m.label} to={m.to}>
              <Card className="p-4 h-full">
                <span className={`h-10 w-10 rounded-xl grid place-items-center ${m.tone}`}><Icon name={m.icon} size={20} /></span>
                <p className="font-extrabold mt-3 leading-tight">{m.label}</p>
                <p className="text-xs text-slate2 mt-0.5">{m.sub}</p>
              </Card>
            </Link>
          ))}
        </div>

        <h2 className="font-extrabold mt-6 mb-2 text-sm text-slate2 uppercase tracking-wide">Coming soon</h2>
        <div className="grid grid-cols-1 gap-2">
          {SOON.map((m) => (
            <div key={m.label} className="bg-white/70 rounded-xl px-4 py-3 flex items-center gap-3 opacity-80">
              <Icon name={m.icon} size={18} className="text-slate2" />
              <div className="flex-1"><p className="font-bold text-sm">{m.label}</p><p className="text-xs text-slate2">{m.sub}</p></div>
              <Chip tone="soon">Coming soon</Chip>
            </div>
          ))}
        </div>

        <div className="flex flex-wrap gap-2 mt-6">
          <Button small variant="secondary" icon="LayoutTemplate" onClick={saveTpl}>Save as template</Button>
          <Button small variant="secondary" icon="Copy" onClick={duplicate}>Duplicate</Button>
          <Button small variant="secondary" icon="CheckCircle2" onClick={toggleDone}>{trip.status === 'completed' ? 'Reopen' : 'Mark completed'}</Button>
          <Button small variant="ghost" icon="Trash2" className="!text-danger" onClick={remove}>Delete</Button>
        </div>
      </div>
    </div>
  );
}
