import { daysBetween } from './util';
import { isLastMinute } from './lastMinute';
import type { Item, Trip } from '../types';

export type Urgency = 'calm' | 'warn' | 'danger' | 'done' | 'muted';

export interface Snapshot {
  total: number;
  packed: number;
  pct: number;
  pending: number;
  essentialsLeft: Item[];
  travelLeft: Item[];
  daysLeft: number; // negative once the trip has started
}

export interface NextAction {
  state: 'empty' | 'upcoming' | 'today' | 'all-packed' | 'ongoing' | 'ended';
  urgency: Urgency;
  chip: string;
  eyebrow: string;
  headline: string;
  sub: string;
  cta: { label: string; to: string };
  secondary: { label: string; to: string } | null;
  showProgress: boolean;
  /** the single pending item to do first, taken from the real list; null when there is nothing to focus on */
  focus: Item | null;
}

const plural = (n: number, w: string) => `${n} ${w}${n === 1 ? '' : 's'}`;

/** Items that matter on the morning you leave: last-minute things and what you wear or keep in pockets. */
export const isTravelDayItem = (i: Item) => isLastMinute(i) || i.bag === 'Wearing / pockets';

export function snapshot(trip: Trip, allItems: Item[], today: string): Snapshot {
  const items = allItems.filter((i) => i.trip_id === trip.id && !i.deleted);
  const pending = items.filter((i) => !i.packed);
  const order = (a: Item, b: Item) => a.sort_order - b.sort_order || a.created_at.localeCompare(b.created_at);
  const packed = items.length - pending.length;
  return {
    total: items.length,
    packed,
    pct: items.length ? Math.round((packed * 100) / items.length) : 0,
    pending: pending.length,
    essentialsLeft: pending.filter((i) => i.priority === 'essential').sort(order),
    travelLeft: pending.filter(isTravelDayItem).sort(order),
    daysLeft: daysBetween(today, trip.start_date)
  };
}

export function urgencyFor(daysLeft: number, remaining: number, kind: 'essentials' | 'travel'): Urgency {
  if (remaining === 0) return 'done';
  if (kind === 'essentials') return daysLeft <= 1 ? 'danger' : daysLeft <= 3 ? 'warn' : 'calm';
  return daysLeft <= 0 ? 'danger' : daysLeft <= 1 ? 'warn' : 'calm';
}

export function nextAction(trip: Trip, items: Item[], today: string): NextAction {
  const s = snapshot(trip, items, today);
  const id = trip.id;
  const packing = `/trips/${id}/packing`;
  const travelDay = `/trips/${id}/travel-day`;
  const review = `/trips/${id}/review`;
  const nights = daysBetween(trip.start_date, trip.end_date);
  const countdown = s.daysLeft > 1 ? `In ${s.daysLeft} days` : s.daysLeft === 1 ? 'Tomorrow' : s.daysLeft === 0 ? 'Today' : '';
  const travelLink = s.travelLeft.length ? { label: `Travel day · ${s.travelLeft.length} pending`, to: travelDay } : null;

  // ended
  if (today > trip.end_date) {
    return {
      state: 'ended', urgency: 'muted', chip: 'Ended', eyebrow: 'Trip ended',
      headline: 'Wrap up this trip',
      sub: s.pending > 0 ? `${plural(s.pending, 'item')} never ticked off. Mark it completed to archive it.` : 'Mark it completed to archive it.',
      cta: { label: 'Review and complete', to: review }, secondary: null, showProgress: false, focus: null
    };
  }
  // in progress
  if (s.daysLeft < 0) {
    const day = -s.daysLeft + 1;
    return {
      state: 'ongoing', urgency: 'calm', chip: `Day ${day}`, eyebrow: 'Trip in progress',
      headline: `Day ${day} of ${nights + 1}`, sub: 'Log expenses and moments as you go.',
      cta: { label: 'Open trip', to: `/trips/${id}` }, secondary: { label: 'Add an expense', to: `/trips/${id}/expenses` }, showProgress: false, focus: null
    };
  }
  // nothing to pack yet
  if (s.total === 0) {
    return {
      state: 'empty', urgency: s.daysLeft <= 3 ? 'warn' : 'calm', chip: countdown, eyebrow: 'Next trip',
      headline: 'Build your packing list', sub: 'Nothing is on the list yet. Voyago can suggest one for this trip.',
      cta: { label: 'Generate list', to: `${packing}?generate=1` }, secondary: null, showProgress: false, focus: null
    };
  }
  // everything packed
  if (s.pending === 0) {
    return {
      state: 'all-packed', urgency: 'done', chip: countdown, eyebrow: 'Next trip',
      headline: 'All packed. Ready to go.', sub: `${plural(s.total, 'item')} ticked off.`,
      cta: { label: 'Final review', to: review }, secondary: null, showProgress: true, focus: null
    };
  }
  const urgency = urgencyFor(s.daysLeft, s.essentialsLeft.length, 'essentials');
  // leaving today
  if (s.daysLeft === 0) {
    if (s.essentialsLeft.length) {
      return {
        state: 'today', urgency: 'danger', chip: 'Today', eyebrow: 'Leaving today',
        headline: `${plural(s.essentialsLeft.length, 'essential')} still not packed`, sub: `${s.pct}% packed. Finish these before you leave.`,
        cta: { label: 'Pack essentials', to: `${packing}?filter=essential` }, secondary: travelLink, showProgress: true, focus: s.essentialsLeft[0] ?? null
      };
    }
    if (s.travelLeft.length) {
      return {
        state: 'today', urgency: 'warn', chip: 'Today', eyebrow: 'Leaving today',
        headline: 'Pack your morning items', sub: `${plural(s.travelLeft.length, 'item')} to grab on your way out.`,
        cta: { label: 'Open Travel day', to: travelDay }, secondary: null, showProgress: true, focus: s.travelLeft[0] ?? null
      };
    }
    return {
      state: 'today', urgency: 'warn', chip: 'Today', eyebrow: 'Leaving today',
      headline: `${plural(s.pending, 'item')} left`, sub: 'Nothing essential is pending.',
      cta: { label: 'Continue packing', to: packing }, secondary: null, showProgress: true, focus: null
    };
  }
  // upcoming
  if (s.essentialsLeft.length) {
    return {
      state: 'upcoming', urgency, chip: countdown, eyebrow: 'Next trip',
      headline: `${plural(s.essentialsLeft.length, 'essential')} left to pack`, sub: `${s.pct}% packed so far.`,
      cta: { label: 'Pack essentials', to: `${packing}?filter=essential` }, secondary: travelLink, showProgress: true, focus: s.essentialsLeft[0] ?? null
    };
  }
  return {
    state: 'upcoming', urgency: 'calm', chip: countdown, eyebrow: 'Next trip',
    headline: 'Essentials are done', sub: `${plural(s.pending, 'optional item')} left, ${s.pct}% packed.`,
    cta: { label: 'Continue packing', to: packing }, secondary: travelLink, showProgress: true, focus: null
  };
}
