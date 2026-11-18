import { buildCtx, type Ctx } from './catalog';
import type { TripType, TravelMode } from '../types';

export interface DefaultTemplate {
  id: string;
  name: string;
  blurb: string;
  type: TripType;
  nights: number;
  mode: TravelMode;
  travellers: number;
  tags: string[];
  international?: boolean;
  traveller_type?: string;
  icon: string;
  tone: string; // tailwind gradient classes
}

export const DEFAULT_TEMPLATES: DefaultTemplate[] = [
  { id: 'weekend', name: 'Weekend Getaway', blurb: '2–3 days', type: 'vacation', nights: 2, mode: 'road', travellers: 2, tags: [], icon: 'Palmtree', tone: 'from-teal to-emerald-500' },
  { id: 'vac5', name: '3–5 Day Vacation', blurb: '4–6 days', type: 'vacation', nights: 4, mode: 'flight', travellers: 2, tags: [], icon: 'Tent', tone: 'from-sky-500 to-teal' },
  { id: 'vac7', name: '7-Day Vacation', blurb: 'A full week', type: 'vacation', nights: 6, mode: 'flight', travellers: 2, tags: [], icon: 'Map', tone: 'from-indigo-500 to-sky-500' },
  { id: 'intl', name: 'International Trip', blurb: '7+ days, passport and visa', type: 'vacation', nights: 7, mode: 'flight', travellers: 2, tags: ['international'], international: true, icon: 'Plane', tone: 'from-navy to-navy-500' },
  { id: 'biz', name: 'Business Trip', blurb: 'Work travel essentials', type: 'business', nights: 3, mode: 'flight', travellers: 1, tags: [], traveller_type: 'solo', icon: 'Briefcase', tone: 'from-slate-700 to-navy' },
  { id: 'wedding', name: 'Wedding Trip', blurb: 'Functions, outfits, accessories', type: 'wedding', nights: 3, mode: 'road', travellers: 2, tags: [], icon: 'Heart', tone: 'from-rose-400 to-amber-400' },
  { id: 'beach', name: 'Beach Holiday', blurb: 'Sun, sand, light packing', type: 'vacation', nights: 5, mode: 'flight', travellers: 2, tags: ['beach', 'hot'], icon: 'Waves', tone: 'from-cyan-400 to-teal' },
  { id: 'winter', name: 'Winter Vacation', blurb: 'Cold weather, layering', type: 'vacation', nights: 6, mode: 'road', travellers: 2, tags: ['winter', 'mountain', 'cold'], icon: 'Snowflake', tone: 'from-blue-400 to-indigo-500' },
  { id: 'trek', name: 'Trekking / Adventure', blurb: 'Trail-ready gear', type: 'adventure', nights: 5, mode: 'road', travellers: 2, tags: ['trek', 'mountain'], icon: 'Mountain', tone: 'from-emerald-600 to-teal' },
  { id: 'family', name: 'Family Vacation', blurb: 'Group friendly', type: 'vacation', nights: 5, mode: 'road', travellers: 4, tags: ['family'], traveller_type: 'family', icon: 'Users', tone: 'from-amber-400 to-orange-400' }
];

export function templateCtx(t: DefaultTemplate): Ctx {
  return buildCtx({
    nights: t.nights, type: t.type, mode: t.mode, travellers: t.travellers, tags: t.tags,
    international: t.international, traveller_type: t.traveller_type
  });
}
