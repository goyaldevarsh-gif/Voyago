import { useState } from 'react';
import { useParams } from 'react-router-dom';
import { Button, Field, Input, ProgressBar, Sheet, TopBar } from '../components/ui';
import { Icon } from '../components/icons';
import { useItems, useTrip } from '../hooks/data';
import { setPacked } from '../db/repo';
import { isLastMinute } from '../lib/lastMinute';
import { fmtDay } from '../lib/util';
import { downloadFile, reminderIcs } from '../lib/ics';
import type { Item } from '../types';

export default function TravelDay() {
  const { id } = useParams();
  const trip = useTrip(id);
  const items = useItems(id);
  const [open, setOpen] = useState(false);
  if (!trip || !items) return <div className="p-6 text-slate2">Loading…</div>;

  const wear = items.filter((i) => i.bag === 'Wearing / pockets');
  const last = items.filter((i) => isLastMinute(i) && i.bag !== 'Wearing / pockets');
  const done = [...wear, ...last].filter((i) => i.packed).length;
  const total = wear.length + last.length;

  const Row = ({ i }: { i: Item }) => (
    <li>
      <button className="w-full flex items-center gap-3 px-4 py-3 text-left" role="checkbox" aria-checked={i.packed} onClick={() => void setPacked(i.id, !i.packed)}>
        <span className={`h-7 w-7 rounded-lg border-2 grid place-items-center shrink-0 ${i.packed ? 'bg-teal border-teal text-white' : 'border-slate-300'}`}>{i.packed && <Icon name="Check" size={16} strokeWidth={3} />}</span>
        <span className="flex-1 min-w-0">
          <span className={`font-semibold leading-snug ${i.packed ? 'line-through text-slate-400' : ''}`}>{i.name}{i.quantity > 1 ? ` ×${i.quantity}` : ''}</span>
          {i.notes && <span className="block text-xs text-slate2">{i.notes}</span>}
        </span>
      </button>
    </li>
  );

  return (
    <div>
      <TopBar title="Travel day" sub={`${trip.name} · ${fmtDay(trip.start_date)}`} back={`/trips/${trip.id}`} />
      <div className="px-4 pb-10 space-y-3">
        <div className="bg-white rounded-2xl shadow-card p-4">
          <div className="flex justify-between text-sm font-bold mb-2"><span>{done} of {total} ready</span><span>{total ? Math.round((done / total) * 100) : 0}%</span></div>
          <ProgressBar value={total ? Math.round((done / total) * 100) : 0} />
          <p className="text-xs text-slate2 mt-2">The things you use until the last minute, and what you wear while travelling. Ticks here update the main packing list too.</p>
        </div>

        <section className="bg-white rounded-2xl shadow-card overflow-hidden">
          <h2 className="px-4 py-3 bg-slate-50 font-extrabold flex items-center gap-2"><Icon name="Clock" size={18} className="text-teal" />Pack in the morning</h2>
          {last.length === 0 ? <p className="px-4 py-3 text-sm text-slate2">Nothing marked. Open an item in the packing list and turn on “Pack on travel morning”.</p> : <ul className="divide-y divide-slate-100">{last.map((i) => <Row key={i.id} i={i} />)}</ul>}
        </section>

        <section className="bg-white rounded-2xl shadow-card overflow-hidden">
          <h2 className="px-4 py-3 bg-slate-50 font-extrabold flex items-center gap-2"><Icon name="Shirt" size={18} className="text-teal" />Wear and keep in pockets</h2>
          {wear.length === 0 ? <p className="px-4 py-3 text-sm text-slate2">Set an item’s bag to “Wearing / pockets” to see it here.</p> : <ul className="divide-y divide-slate-100">{wear.map((i) => <Row key={i.id} i={i} />)}</ul>}
        </section>

        <Button full variant="secondary" icon="Bell" onClick={() => setOpen(true)}>Remind me on travel morning</Button>
      </div>
      {open && <ReminderSheet onClose={() => setOpen(false)} date={trip.start_date} name={trip.name} lines={[...last, ...wear].map((i) => i.name)} />}
    </div>
  );
}

function ReminderSheet({ date, name, lines, onClose }: { date: string; name: string; lines: string[]; onClose: () => void }) {
  const [time, setTime] = useState('06:00');
  const [d, setD] = useState(date);
  function make() {
    const ics = reminderIcs({
      title: `Pack last items: ${name}`, date: d, time, alarmMinutes: [0, 30],
      description: `Morning of travel. Pack and carry:\n${lines.map((l) => `- ${l}`).join('\n')}`
    });
    downloadFile('voyago-reminder.ics', ics, 'text/calendar');
    onClose();
  }
  return (
    <Sheet open onClose={onClose} title="Travel morning reminder">
      <div className="space-y-3">
        <p className="text-sm text-slate2">Adds an event with the full list to your phone’s calendar, with an alert at the time and 30 minutes before. Open the downloaded file and choose Add to Calendar.</p>
        <div className="grid grid-cols-2 gap-3">
          <Field label="Date"><Input type="date" value={d} onChange={(e) => setD(e.target.value)} /></Field>
          <Field label="Time"><Input type="time" value={time} onChange={(e) => setTime(e.target.value)} /></Field>
        </div>
        <Button full icon="Download" onClick={make}>Create reminder</Button>
      </div>
    </Sheet>
  );
}
