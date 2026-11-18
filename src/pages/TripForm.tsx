import { useEffect, useRef, useState } from 'react';
import { useNavigate, useParams } from 'react-router-dom';
import { Button, Chip, Field, Input, Select, Stepper, Textarea, TopBar, TripCover, useUi } from '../components/ui';
import { Icon } from '../components/icons';
import { useTrip, useTrips } from '../hooks/data';
import { addTraveller, copyTripItems, createTrip, updateTrip } from '../db/repo';
import { db } from '../db/local';
import { fetchWeather } from '../lib/weather';
import { resizeToDataUrl } from '../lib/image';
import { nightsOf, todayStr, parseDay } from '../lib/util';
import type { TravellerType, TravelMode, TripType, WeatherSummary } from '../types';

const TRAVELLER_TYPES: TravellerType[] = ['solo', 'couple', 'family', 'group'];
const TRIP_TYPES: TripType[] = ['vacation', 'business', 'wedding', 'adventure', 'medical', 'other'];
const MODES: TravelMode[] = ['flight', 'train', 'road', 'other'];
const cap = (s: string) => s.charAt(0).toUpperCase() + s.slice(1);

function plusDays(d: string, n: number) {
  const x = parseDay(d); x.setDate(x.getDate() + n);
  return todayStr(x);
}

export default function TripForm() {
  const { id } = useParams();
  const editing = !!id;
  const existing = useTrip(id);
  const allTrips = useTrips();
  const nav = useNavigate();
  const { toast } = useUi();
  const file = useRef<HTMLInputElement>(null);

  const [f, setF] = useState({
    name: '', destination: '', start_date: plusDays(todayStr(), 7), end_date: plusDays(todayStr(), 10),
    travellers_count: 1, traveller_type: 'solo' as TravellerType, trip_type: 'vacation' as TripType,
    travel_mode: 'flight' as TravelMode, accommodation: '', notes: '', international: false,
    cover_image: null as string | null, weather: null as WeatherSummary | null
  });
  const [names, setNames] = useState('');
  const [copyFrom, setCopyFrom] = useState('');
  const [loadedFor, setLoadedFor] = useState<string | null>(null);
  const [wxBusy, setWxBusy] = useState(false);
  const [err, setErr] = useState('');
  const set = <K extends keyof typeof f>(k: K, v: (typeof f)[K]) => setF((p) => ({ ...p, [k]: v }));

  useEffect(() => {
    if (!existing || loadedFor === existing.id) return;
    setLoadedFor(existing.id);
    const { name, destination, start_date, end_date, travellers_count, traveller_type, trip_type, travel_mode, accommodation, notes, international, cover_image, weather } = existing;
    setF({ name, destination, start_date, end_date, travellers_count, traveller_type, trip_type, travel_mode, accommodation, notes, international, cover_image, weather });
    void db.travellers.where('trip_id').equals(existing.id).toArray().then((t) => setNames(t.filter((x) => !x.deleted).map((x) => x.name).join(', ')));
  }, [existing, loadedFor]);

  function typeChange(t: TravellerType) {
    setF((p) => ({ ...p, traveller_type: t, travellers_count: t === 'solo' ? 1 : t === 'couple' ? 2 : Math.max(p.travellers_count, 3) }));
  }

  async function weather() {
    if (!f.destination.trim()) { setErr('Enter a destination first'); return; }
    setWxBusy(true);
    const w = await fetchWeather(f.destination, f.start_date, f.end_date);
    setWxBusy(false);
    if (w) { set('weather', w); toast('Weather added'); } else toast('Could not fetch weather. Check your connection.');
  }

  async function pick(e: React.ChangeEvent<HTMLInputElement>) {
    const file = e.target.files?.[0];
    if (!file) return;
    try { set('cover_image', await resizeToDataUrl(file)); } catch { toast('Could not read that image'); }
  }

  async function save() {
    setErr('');
    if (!f.name.trim()) return setErr('Give the trip a name');
    if (f.end_date < f.start_date) return setErr('Return date must be after departure');
    const body = { ...f, name: f.name.trim(), destination: f.destination.trim() };
    let tripId = id;
    if (editing && id) {
      await updateTrip(id, body);
      const old = (await db.travellers.where('trip_id').equals(id).toArray()).filter((t) => !t.deleted);
      const want = names.split(',').map((s) => s.trim()).filter(Boolean);
      const keep = new Set<string>();
      for (const n of want) { const m = old.find((o) => o.name === n); if (m) keep.add(m.id); else await addTraveller(id, n); }
      for (const o of old) if (!keep.has(o.id)) await db.travellers.put({ ...o, deleted: true, updated_at: new Date().toISOString() });
      toast('Trip updated');
      nav(`/trips/${id}`);
      return;
    }
    const t = await createTrip(body);
    tripId = t.id;
    for (const n of names.split(',').map((s) => s.trim()).filter(Boolean)) await addTraveller(t.id, n);
    if (copyFrom) {
      const r = await copyTripItems(copyFrom, t.id, true);
      toast(`Copied ${r.added} items`);
      nav(`/trips/${tripId}/packing`);
    } else {
      nav(`/trips/${tripId}/packing?generate=1`);
    }
  }

  const nights = nightsOf(f.start_date, f.end_date);
  const others = (allTrips ?? []).filter((t) => t.id !== id);

  return (
    <div>
      <TopBar title={editing ? 'Edit trip' : 'Create new trip'} back={editing ? `/trips/${id}` : '/trips'} />
      <div className="px-4 pb-10 space-y-4 max-w-2xl mx-auto">
        <button type="button" onClick={() => file.current?.click()} className="block w-full">
          <TripCover trip={{ ...f }} className="h-36 rounded-2xl">
            <div className="absolute inset-0 grid place-items-center text-white font-bold gap-1">
              <span className="flex flex-col items-center gap-1"><Icon name="Image" size={26} />{f.cover_image ? 'Change cover' : 'Add trip cover'}</span>
            </div>
          </TripCover>
        </button>
        <input ref={file} type="file" accept="image/*" className="hidden" onChange={pick} aria-label="Trip cover image" />

        <Field label="Trip name"><Input value={f.name} onChange={(e) => set('name', e.target.value)} placeholder="Goa Getaway" /></Field>
        <Field label="Destination"><Input value={f.destination} onChange={(e) => set('destination', e.target.value)} placeholder="Goa" /></Field>
        <div className="grid grid-cols-2 gap-3">
          <Field label="Departure"><Input type="date" value={f.start_date} onChange={(e) => { const v = e.target.value; setF((p) => ({ ...p, start_date: v, end_date: p.end_date < v ? v : p.end_date })); }} /></Field>
          <Field label="Return"><Input type="date" min={f.start_date} value={f.end_date} onChange={(e) => set('end_date', e.target.value)} /></Field>
        </div>
        <p className="text-xs text-slate2 -mt-2">{nights} night{nights === 1 ? '' : 's'}, {nights + 1} days</p>

        <Field label="Travellers">
          <div className="flex flex-wrap gap-2 mb-2">{TRAVELLER_TYPES.map((t) => <Chip key={t} active={f.traveller_type === t} onClick={() => typeChange(t)}>{cap(t)}</Chip>)}</div>
          <div className="flex items-center gap-3">
            <Stepper value={f.travellers_count} onChange={(n) => set('travellers_count', n)} max={40} />
            <span className="text-sm text-slate2">people</span>
          </div>
        </Field>
        {f.travellers_count > 1 && (
          <Field label="Traveller names (optional)" hint="Separate with commas"><Input value={names} onChange={(e) => setNames(e.target.value)} placeholder="Riya, Aman" /></Field>
        )}

        <Field label="Trip type"><Select value={f.trip_type} onChange={(e) => set('trip_type', e.target.value as TripType)}>{TRIP_TYPES.map((t) => <option key={t} value={t}>{cap(t)}</option>)}</Select></Field>
        <Field label="Travel mode"><Select value={f.travel_mode} onChange={(e) => set('travel_mode', e.target.value as TravelMode)}>{MODES.map((t) => <option key={t} value={t}>{cap(t)}</option>)}</Select></Field>
        <Field label="Accommodation" hint="Hotel, homestay, BnB, camp. Basic stays get extra items like a towel.">
          <Input value={f.accommodation} onChange={(e) => set('accommodation', e.target.value)} placeholder="BnB" />
        </Field>
        <label className="flex items-center gap-3 text-sm font-semibold">
          <input type="checkbox" className="h-5 w-5 accent-teal" checked={f.international} onChange={(e) => set('international', e.target.checked)} /> International trip (passport, visa, adapters)
        </label>

        <div className="rounded-2xl bg-white shadow-card p-4">
          <div className="flex items-center justify-between gap-3">
            <div>
              <p className="font-bold text-sm flex items-center gap-1.5"><Icon name="CloudSun" size={16} className="text-teal" /> Weather (optional)</p>
              <p className="text-xs text-slate2">{f.weather ? `${f.weather.min_c}° to ${f.weather.max_c}°C, rain on ${f.weather.rain_pct}% of days${f.weather.basis === 'last-year' ? ' (same dates last year)' : ''}` : 'Helps the generator pick jackets or sunscreen.'}</p>
            </div>
            <Button small variant="secondary" onClick={weather} disabled={wxBusy}>{wxBusy ? 'Fetching…' : f.weather ? 'Refresh' : 'Fetch'}</Button>
          </div>
        </div>

        {!editing && others.length > 0 && (
          <Field label="Start from a previous trip's list (optional)">
            <Select value={copyFrom} onChange={(e) => setCopyFrom(e.target.value)}>
              <option value="">Generate a fresh list</option>
              {others.map((t) => <option key={t.id} value={t.id}>{t.name}</option>)}
            </Select>
          </Field>
        )}
        <Field label="Notes (optional)"><Textarea rows={3} value={f.notes} onChange={(e) => set('notes', e.target.value)} placeholder="Anything to remember" /></Field>

        {err && <p className="text-danger text-sm font-semibold" role="alert">{err}</p>}
        <Button full onClick={save}>{editing ? 'Save changes' : 'Create trip'}</Button>
      </div>
    </div>
  );
}
