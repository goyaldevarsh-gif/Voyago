import { useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { Button, Chip, EmptyState } from '../components/ui';
import { TripRow } from '../components/TripCard';
import { useAllItems, useTrips } from '../hooks/data';
import { todayStr } from '../lib/util';

export default function Trips() {
  const trips = useTrips();
  const items = useAllItems();
  const nav = useNavigate();
  const [tab, setTab] = useState<'upcoming' | 'past'>('upcoming');
  if (!trips || !items) return <div className="p-6 text-slate2">Loading…</div>;

  const today = todayStr();
  const upcoming = trips.filter((t) => t.end_date >= today && t.status !== 'completed');
  const past = trips.filter((t) => !(t.end_date >= today && t.status !== 'completed')).sort((a, b) => b.start_date.localeCompare(a.start_date));
  const list = tab === 'upcoming' ? upcoming : past;

  return (
    <div className="px-4 pt-6 safe-t">
      <div className="flex items-center justify-between">
        <h1 className="text-2xl font-extrabold">My Trips</h1>
        <Button small icon="Plus" onClick={() => nav('/trips/new')}>New trip</Button>
      </div>
      <div className="flex gap-2 mt-4">
        <Chip active={tab === 'upcoming'} onClick={() => setTab('upcoming')}>Upcoming ({upcoming.length})</Chip>
        <Chip active={tab === 'past'} onClick={() => setTab('past')}>Past ({past.length})</Chip>
      </div>
      <div className="mt-4 space-y-2.5">
        {list.length === 0 ? (
          <EmptyState icon="Luggage" title={tab === 'upcoming' ? 'No upcoming trips' : 'No past trips yet'}
            body={tab === 'upcoming' ? 'Plan a trip and get a packing list that fits it.' : 'Finished trips show up here, and you can reuse their lists.'}
            action={tab === 'upcoming' ? <Button icon="Plus" onClick={() => nav('/trips/new')}>Create trip</Button> : undefined} />
        ) : list.map((t) => <TripRow key={t.id} trip={t} items={items} />)}
      </div>
    </div>
  );
}
