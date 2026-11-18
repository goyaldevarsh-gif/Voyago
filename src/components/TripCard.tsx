import { Link } from 'react-router-dom';
import { Card, ProgressBar, Chip, TripCover } from './ui';
import { Icon } from './icons';
import { countdown, fmtRange, nightsOf, pct } from '../lib/util';
import type { Item, Trip } from '../types';

export function tripProgress(items: Item[], tripId: string) {
  const mine = items.filter((i) => i.trip_id === tripId);
  const packed = mine.filter((i) => i.packed).length;
  return { total: mine.length, packed, pct: pct(packed, mine.length) };
}

export function TripRow({ trip, items }: { trip: Trip; items: Item[] }) {
  const p = tripProgress(items, trip.id);
  const c = countdown(trip.start_date);
  return (
    <Link to={`/trips/${trip.id}`} className="block">
      <Card className="p-3 flex items-center gap-3">
        <TripCover trip={trip} className="h-16 w-16 rounded-xl shrink-0" />
        <div className="min-w-0 flex-1">
          <div className="flex items-center gap-2">
            <h3 className="font-extrabold truncate">{trip.name}</h3>
            {c.days >= 0 && trip.status !== 'completed' && <Chip tone="ok">{c.label}</Chip>}
            {trip.status === 'completed' && <Chip tone="soon">Done</Chip>}
          </div>
          <p className="text-xs text-slate2 truncate">{fmtRange(trip.start_date, trip.end_date)} · {nightsOf(trip.start_date, trip.end_date)} nights</p>
          <div className="flex items-center gap-2 mt-2">
            <ProgressBar value={p.pct} className="flex-1" />
            <span className="text-xs font-bold tabular-nums text-slate2">{p.packed}/{p.total}</span>
          </div>
        </div>
        <Icon name="ChevronRight" size={18} className="text-slate-300" />
      </Card>
    </Link>
  );
}
