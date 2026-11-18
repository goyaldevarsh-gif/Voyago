import { useEffect, useRef, useState } from 'react';
import { useParams } from 'react-router-dom';
import { Textarea, TopBar } from '../components/ui';
import { useTrip } from '../hooks/data';
import { updateTrip } from '../db/repo';

export default function Notes() {
  const { id } = useParams();
  const trip = useTrip(id);
  const [text, setText] = useState('');
  const [saved, setSaved] = useState(true);
  const loaded = useRef<string | null>(null);

  useEffect(() => {
    if (trip && loaded.current !== trip.id) { loaded.current = trip.id; setText(trip.notes); }
  }, [trip]);

  useEffect(() => {
    if (!trip || loaded.current !== trip.id || text === trip.notes) { return; }
    setSaved(false);
    const t = setTimeout(() => { void updateTrip(trip.id, { notes: text }).then(() => setSaved(true)); }, 600);
    return () => clearTimeout(t);
  }, [text, trip]);

  if (!trip) return <div className="p-6 text-slate2">Loading…</div>;
  return (
    <div>
      <TopBar title="Trip notes" sub={trip.name} back={`/trips/${trip.id}`} right={<span className="text-xs text-slate2 pr-3">{saved ? 'Saved' : 'Saving…'}</span>} />
      <div className="px-4">
        <Textarea rows={16} value={text} onChange={(e) => setText(e.target.value)} placeholder="Hotel address, booking IDs, things to remember…" aria-label="Trip notes" />
      </div>
    </div>
  );
}
