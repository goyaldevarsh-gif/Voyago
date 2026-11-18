import type { Priority, TripType, TravelMode, WeatherSummary } from '../types';

export const DEFAULT_CATEGORIES = [
  { name: 'Clothing', icon: 'Shirt' },
  { name: 'Footwear', icon: 'Footprints' },
  { name: 'Toiletries', icon: 'Droplets' },
  { name: 'Medicines & First Aid', icon: 'BriefcaseMedical' },
  { name: 'Electronics', icon: 'Laptop' },
  { name: 'Accessories', icon: 'Glasses' },
  { name: 'Travel Gear', icon: 'Backpack' },
  { name: 'Documents & Essentials', icon: 'IdCard' },
  { name: 'Miscellaneous', icon: 'Package' }
] as const;

export const BAGS = ['Suitcase / trolley', 'Backpack', 'Medicine pouch', 'Toiletry bag', 'Tech pouch', 'Wearing / pockets'] as const;

/** What the generator knows about a trip. Everything is derived, nothing is hardcoded per destination. */
export interface Ctx {
  nights: number;
  days: number;
  /** clothing days to pack for: long trips assume laundry */
  L: number;
  type: TripType;
  mode: TravelMode;
  travellers: number;
  intl: boolean;
  hot: boolean;
  cold: boolean;
  chilly: boolean; // cool evenings
  wet: boolean;
  beach: boolean;
  trek: boolean;
  basicStay: boolean;
  business: boolean;
  wedding: boolean;
  family: boolean;
  minC: number | null;
  tags: string[];
}

const BEACH = /goa|beach|andaman|kovalam|gokarna|varkala|pondicherry|bali|phuket|maldives|lakshadweep|puri|digha/i;
const MOUNTAIN = /manali|shimla|kashmir|srinagar|leh|ladakh|spiti|himachal|kasauli|mussoorie|nainital|darjeeling|sikkim|gulmarg|auli|dalhousie|dharamshala|kedar|kullu|munnar|ooty/i;
const BASIC = /basic|homestay|home stay|hostel|camp|bnb|b&b|guest ?house|dorm|tent/i;

export function buildCtx(p: {
  nights: number; type: TripType; mode: TravelMode; travellers: number; traveller_type?: string;
  destination?: string; weather?: WeatherSummary | null; international?: boolean; accommodation?: string;
  tags?: string[];
}): Ctx {
  const dest = p.destination ?? '';
  const tags = new Set(p.tags ?? []);
  if (BEACH.test(dest)) tags.add('beach');
  if (MOUNTAIN.test(dest)) tags.add('mountain');
  const w = p.weather ?? null;
  const hot = tags.has('beach') || tags.has('hot') || (w ? w.avg_c >= 28 : false);
  const cold = tags.has('winter') || tags.has('cold') || (w ? w.avg_c <= 15 : false);
  const chilly = cold || (w ? w.min_c <= 18 : false) || tags.has('mountain');
  const wet = tags.has('monsoon') || (w ? w.rain_pct >= 40 : false);
  const trek = p.type === 'adventure' || tags.has('trek');
  const nights = Math.max(0, p.nights);
  const days = nights + 1;
  return {
    nights, days, L: Math.min(days, 7), type: p.type, mode: p.mode, travellers: p.travellers,
    intl: !!p.international || tags.has('international'),
    hot: hot && !cold, cold, chilly, wet,
    beach: tags.has('beach'), trek, basicStay: BASIC.test(p.accommodation ?? '') || trek,
    business: p.type === 'business', wedding: p.type === 'wedding',
    family: p.traveller_type === 'family' || tags.has('family'),
    minC: w ? w.min_c : null, tags: [...tags]
  };
}

export interface CatItem {
  name: string;
  category: string;
  priority: Priority;
  bag: string;
  /** quantity and the reason shown to the user; return null to skip for this trip */
  rule: (c: Ctx) => { qty: number; why: string } | null;
}

const cl = (n: number, lo: number, hi: number) => Math.min(hi, Math.max(lo, Math.round(n)));
const always = (qty = 1, why = 'Standard for every trip') => () => ({ qty, why });
const when = (cond: (c: Ctx) => boolean, qty: number | ((c: Ctx) => number), why: string | ((c: Ctx) => string)) =>
  (c: Ctx) => (cond(c) ? { qty: typeof qty === 'function' ? qty(c) : qty, why: typeof why === 'function' ? why(c) : why } : null);
const none = () => null;

const T = 'Suitcase / trolley', B = 'Backpack', M = 'Medicine pouch', G = 'Toiletry bag', X = 'Tech pouch', W = 'Wearing / pockets';

export const CATALOG: CatItem[] = [
  // ---------- Clothing
  { name: 'T-shirts', category: 'Clothing', priority: 'essential', bag: T,
    rule: (c) => {
      if (c.business) return { qty: cl(c.L * 0.4, 1, 3), why: 'Business trip, shirts do most of the work' };
      if (c.wedding) return { qty: 2, why: 'Wedding trip, a couple for travel and rest days' };
      if (c.hot) return { qty: cl(c.L + 1, 2, 9), why: `Hot weather, ${c.days} days, one extra for sweat` };
      if (c.cold) return { qty: cl(c.L * 0.7, 2, 6), why: 'Cold weather, worn under layers' };
      return { qty: cl(c.L, 2, 8), why: `${c.days} days, one a day (laundry assumed after 7)` };
    } },
  { name: 'Shirts', category: 'Clothing', priority: 'optional', bag: T,
    rule: (c) => c.business ? { qty: cl(c.L * 0.8, 2, 6), why: 'Business trip' }
      : c.wedding ? { qty: 2, why: 'Wedding trip' }
      : c.type === 'vacation' && c.days >= 3 && !c.beach ? { qty: 1, why: 'One smart-casual option for dinners' } : null },
  { name: 'Jeans', category: 'Clothing', priority: 'optional', bag: T,
    rule: when((c) => !c.trek && !c.business && !c.beach, (c) => cl(c.L / 3, 1, 3), (c) => `${c.days} days, rewear between washes`) },
  { name: 'Trousers', category: 'Clothing', priority: 'optional', bag: T,
    rule: when((c) => c.business || c.wedding, (c) => cl(c.L / 2, 1, 3), 'Smart bottoms for meetings and functions') },
  { name: 'Trekking pants', category: 'Clothing', priority: 'essential', bag: T,
    rule: when((c) => c.trek, (c) => cl(c.L / 2, 2, 3), 'Quick-dry pants for trekking') },
  { name: 'Shorts', category: 'Clothing', priority: 'optional', bag: T,
    rule: when((c) => c.hot || c.beach, (c) => cl(c.L / 2, 2, 5), 'Hot or beach destination') },
  { name: 'Innerwear', category: 'Clothing', priority: 'essential', bag: T,
    rule: (c) => ({ qty: cl(c.L + 1, 2, 9), why: `${c.days} days plus one spare` }) },
  { name: 'Socks', category: 'Clothing', priority: 'essential', bag: T,
    rule: (c) => ({ qty: cl(c.L + (c.cold || c.trek ? 2 : 1), 2, 10), why: c.trek ? 'Trekking, extra pairs for wet feet' : `${c.days} days plus one spare` }) },
  { name: 'Sleepwear', category: 'Clothing', priority: 'optional', bag: T,
    rule: (c) => ({ qty: cl(c.L / 3, 1, 3), why: 'Worn more than once' }) },
  { name: 'Jackets', category: 'Clothing', priority: 'essential', bag: W,
    rule: when((c) => c.cold || c.chilly, (c) => (c.cold && c.minC !== null && c.minC <= 5 ? 2 : 1), (c) => c.minC !== null ? `Lows around ${c.minC}°C` : 'Cold or cool evenings') },
  { name: 'Hoodies', category: 'Clothing', priority: 'optional', bag: T,
    rule: when((c) => (c.cold || c.chilly) && !c.hot, (c) => (c.cold ? 2 : 1), 'Cool evenings, easy layer') },
  { name: 'Thermal innerwear', category: 'Clothing', priority: 'essential', bag: T,
    rule: when((c) => c.cold && (c.minC === null || c.minC <= 8 || c.trek), 2, 'Very cold nights') },
  { name: 'Woollen cap & gloves', category: 'Clothing', priority: 'essential', bag: B,
    rule: when((c) => c.cold && (c.minC === null || c.minC <= 8), 1, 'Very cold weather') },
  { name: 'Ethnic wear', category: 'Clothing', priority: 'essential', bag: T,
    rule: when((c) => c.wedding, (c) => cl(c.days, 2, 5), 'One outfit per function, rewear where you can') },
  { name: 'Formal wear', category: 'Clothing', priority: 'essential', bag: T,
    rule: (c) => c.business ? { qty: cl(c.L / 2, 1, 3), why: 'Business trip' } : c.wedding ? { qty: 1, why: 'Wedding trip' } : null },
  { name: 'Swimwear', category: 'Clothing', priority: 'optional', bag: T,
    rule: when((c) => c.beach, 2, 'Beach destination') },
  { name: 'Rain jacket', category: 'Clothing', priority: 'optional', bag: B,
    rule: when((c) => c.wet || c.trek, 1, (c) => (c.wet ? 'Rain likely' : 'Weather turns quickly on a trek')) },

  // ---------- Footwear
  { name: 'Sneakers', category: 'Footwear', priority: 'essential', bag: W,
    rule: when((c) => !c.trek, 1, 'Comfortable everyday pair, worn while travelling') },
  { name: 'Trekking shoes', category: 'Footwear', priority: 'essential', bag: W,
    rule: when((c) => c.trek, 1, 'Trekking trip') },
  { name: 'Formal shoes', category: 'Footwear', priority: 'optional', bag: T,
    rule: when((c) => c.business || c.wedding, 1, 'Business or wedding trip') },
  { name: 'Sandals', category: 'Footwear', priority: 'optional', bag: T,
    rule: when((c) => c.hot || c.beach, 1, 'Hot or beach destination') },
  { name: 'Slippers', category: 'Footwear', priority: 'optional', bag: T, rule: always(1, 'For the room and bathroom') },
  { name: 'Sports shoes', category: 'Footwear', priority: 'optional', bag: T, rule: none },

  // ---------- Toiletries
  { name: 'Toothbrush', category: 'Toiletries', priority: 'essential', bag: G, rule: always() },
  { name: 'Toothpaste', category: 'Toiletries', priority: 'essential', bag: G, rule: always() },
  { name: 'Face wash', category: 'Toiletries', priority: 'optional', bag: G, rule: always() },
  { name: 'Shampoo', category: 'Toiletries', priority: 'optional', bag: G, rule: always(1, 'Small bottle or sachets') },
  { name: 'Conditioner', category: 'Toiletries', priority: 'optional', bag: G, rule: none },
  { name: 'Moisturizer', category: 'Toiletries', priority: 'optional', bag: G, rule: when((c) => c.cold || c.chilly, 1, 'Dry cold air') },
  { name: 'Sunscreen', category: 'Toiletries', priority: 'essential', bag: G,
    rule: when((c) => c.hot || c.beach || c.trek || c.tags.includes('mountain'), 1, 'Strong sun at this destination') },
  { name: 'Lip balm', category: 'Toiletries', priority: 'optional', bag: W, rule: when((c) => c.cold || c.chilly, 1, 'Dry cold air') },
  { name: 'Deodorant', category: 'Toiletries', priority: 'essential', bag: G, rule: always() },
  { name: 'Perfume', category: 'Toiletries', priority: 'optional', bag: G, rule: when((c) => c.wedding || c.business, 1, 'Events and meetings') },
  { name: 'Shaving kit', category: 'Toiletries', priority: 'optional', bag: G, rule: always() },
  { name: 'Skincare', category: 'Toiletries', priority: 'optional', bag: G, rule: none },
  { name: 'Hand sanitizer', category: 'Toiletries', priority: 'optional', bag: B, rule: always() },
  { name: 'Wet wipes', category: 'Toiletries', priority: 'optional', bag: B, rule: when((c) => c.mode !== 'other' || c.trek, 1, 'Handy in transit') },
  { name: 'Comb', category: 'Toiletries', priority: 'optional', bag: G, rule: none },

  // ---------- Medicines & First Aid
  { name: 'Regular medicines', category: 'Medicines & First Aid', priority: 'essential', bag: M, rule: always(1, 'Everything you take regularly, plus spare days') },
  { name: 'Pain relief medication', category: 'Medicines & First Aid', priority: 'essential', bag: M, rule: always() },
  { name: 'Basic first aid', category: 'Medicines & First Aid', priority: 'essential', bag: M, rule: always() },
  { name: 'Bandages', category: 'Medicines & First Aid', priority: 'optional', bag: M, rule: always() },
  { name: 'Antiseptic', category: 'Medicines & First Aid', priority: 'optional', bag: M, rule: always() },
  { name: 'ORS sachets', category: 'Medicines & First Aid', priority: 'optional', bag: M, rule: always(3, 'Stomach upsets happen on trips') },
  { name: 'Antacid', category: 'Medicines & First Aid', priority: 'optional', bag: M, rule: none },
  { name: 'Cold and allergy tablets', category: 'Medicines & First Aid', priority: 'optional', bag: M, rule: when((c) => c.chilly || c.wet, 1, 'Weather changes') },
  { name: 'Mosquito repellent', category: 'Medicines & First Aid', priority: 'optional', bag: M, rule: when((c) => c.hot || c.wet || c.beach || c.trek, 1, 'Mosquitoes likely') },
  { name: 'Motion sickness tablets', category: 'Medicines & First Aid', priority: 'optional', bag: M, rule: when((c) => c.mode === 'road' && c.tags.includes('mountain'), 1, 'Winding mountain roads') },
  { name: 'Altitude sickness medicine (as advised)', category: 'Medicines & First Aid', priority: 'optional', bag: M, rule: when((c) => c.trek && c.cold, 1, 'High altitude, check dosage with a doctor') },
  { name: 'Personal medical supplies', category: 'Medicines & First Aid', priority: 'optional', bag: M, rule: none },
  { name: 'Thermometer', category: 'Medicines & First Aid', priority: 'optional', bag: M, rule: none },

  // ---------- Electronics
  { name: 'Mobile phone', category: 'Electronics', priority: 'essential', bag: W, rule: always() },
  { name: 'Phone charger', category: 'Electronics', priority: 'essential', bag: X, rule: always() },
  { name: 'Power bank', category: 'Electronics', priority: 'essential', bag: X, rule: always() },
  { name: 'Earphones', category: 'Electronics', priority: 'optional', bag: X, rule: always() },
  { name: 'Laptop', category: 'Electronics', priority: 'essential', bag: B, rule: when((c) => c.business, 1, 'Business trip') },
  { name: 'Laptop charger', category: 'Electronics', priority: 'essential', bag: X, rule: when((c) => c.business, 1, 'Business trip') },
  { name: 'Smartwatch', category: 'Electronics', priority: 'optional', bag: W, rule: none },
  { name: 'Smartwatch charger', category: 'Electronics', priority: 'optional', bag: X, rule: none },
  { name: 'Camera', category: 'Electronics', priority: 'optional', bag: B, rule: none },
  { name: 'Travel adapters', category: 'Electronics', priority: 'essential', bag: X, rule: when((c) => c.intl, 1, 'International trip') },
  { name: 'Extension board', category: 'Electronics', priority: 'optional', bag: X, rule: when((c) => c.travellers >= 3 || c.basicStay, 1, 'Several people charging, few sockets') },

  // ---------- Accessories
  { name: 'Sunglasses', category: 'Accessories', priority: 'optional', bag: B, rule: when((c) => c.hot || c.beach || c.trek || c.cold, 1, 'Strong sun or snow glare') },
  { name: 'Watch', category: 'Accessories', priority: 'optional', bag: W, rule: none },
  { name: 'Belt', category: 'Accessories', priority: 'optional', bag: W, rule: when((c) => c.business || c.wedding, 1, 'Formal outfits') },
  { name: 'Cap', category: 'Accessories', priority: 'optional', bag: B, rule: when((c) => c.hot || c.beach || c.trek, 1, 'Sun protection') },
  { name: 'Jewellery', category: 'Accessories', priority: 'optional', bag: M, rule: when((c) => c.wedding, 1, 'Functions') },

  // ---------- Travel Gear
  { name: 'Suitcase', category: 'Travel Gear', priority: 'essential', bag: T, rule: when((c) => c.mode !== 'other' && !c.trek, 1, 'Main luggage') },
  { name: 'Backpack', category: 'Travel Gear', priority: 'essential', bag: B, rule: always(1, 'Day bag and essentials') },
  { name: 'Packing cubes', category: 'Travel Gear', priority: 'optional', bag: T, rule: none },
  { name: 'Luggage locks', category: 'Travel Gear', priority: 'optional', bag: T, rule: when((c) => c.mode === 'flight' || c.mode === 'train', 1, 'Checked or shared luggage') },
  { name: 'Laundry bag', category: 'Travel Gear', priority: 'optional', bag: T, rule: always(1, 'Keeps worn clothes apart') },
  { name: 'Water bottle', category: 'Travel Gear', priority: 'essential', bag: B, rule: always() },
  { name: 'Umbrella', category: 'Travel Gear', priority: 'optional', bag: B, rule: when((c) => c.wet && !c.trek, 1, 'Rain likely') },
  { name: 'Towel', category: 'Travel Gear', priority: 'essential', bag: T, rule: when((c) => c.basicStay || c.beach, 1, 'Basic stay or beach, do not count on one') },
  { name: 'Torch', category: 'Travel Gear', priority: 'optional', bag: B, rule: when((c) => c.trek, 1, 'Trekking') },
  { name: 'Trekking pole', category: 'Travel Gear', priority: 'optional', bag: B, rule: none },

  // ---------- Documents & Essentials
  { name: 'ID card', category: 'Documents & Essentials', priority: 'essential', bag: W, rule: when((c) => !c.intl, 1, 'Needed at check-in and travel') },
  { name: 'Passport', category: 'Documents & Essentials', priority: 'essential', bag: W, rule: when((c) => c.intl, 1, 'International trip') },
  { name: 'Visa', category: 'Documents & Essentials', priority: 'essential', bag: W, rule: when((c) => c.intl, 1, 'International trip, check requirement') },
  { name: 'Travel insurance', category: 'Documents & Essentials', priority: 'optional', bag: W, rule: when((c) => c.intl, 1, 'International trip') },
  { name: 'Wallet', category: 'Documents & Essentials', priority: 'essential', bag: W, rule: always() },
  { name: 'Cash', category: 'Documents & Essentials', priority: 'essential', bag: W, rule: always(1, 'Small notes for tips and local transport') },
  { name: 'Cards', category: 'Documents & Essentials', priority: 'essential', bag: W, rule: always() },
  { name: 'Driving licence', category: 'Documents & Essentials', priority: 'essential', bag: W, rule: when((c) => c.mode === 'road', 1, 'Driving') },
  { name: 'Tickets / boarding passes', category: 'Documents & Essentials', priority: 'essential', bag: W, rule: when((c) => c.mode === 'flight' || c.mode === 'train', 1, 'Travel tickets') },
  { name: 'Hotel booking confirmation', category: 'Documents & Essentials', priority: 'essential', bag: W, rule: always(1, 'Needed at check-in') },

  // ---------- Miscellaneous
  { name: 'Snacks', category: 'Miscellaneous', priority: 'optional', bag: B, rule: when((c) => c.mode === 'road' || c.mode === 'train' || c.trek, 1, 'Long travel hours') },
  { name: 'Travel pillow', category: 'Miscellaneous', priority: 'optional', bag: B, rule: when((c) => c.mode === 'flight' || c.mode === 'train', 1, 'Long sitting hours') },
  { name: 'Eye mask', category: 'Miscellaneous', priority: 'optional', bag: B, rule: none },
  { name: 'Earplugs', category: 'Miscellaneous', priority: 'optional', bag: B, rule: none },
  { name: 'Books', category: 'Miscellaneous', priority: 'optional', bag: B, rule: none },
  { name: 'Notebook and pen', category: 'Miscellaneous', priority: 'optional', bag: B, rule: when((c) => c.business, 1, 'Meetings') },
  { name: 'Visiting cards', category: 'Miscellaneous', priority: 'optional', bag: B, rule: when((c) => c.business, 1, 'Business trip') },
  { name: 'Gift or shagun envelope', category: 'Miscellaneous', priority: 'essential', bag: B, rule: when((c) => c.wedding, 1, 'Wedding trip') },
  { name: 'Ziplock bags', category: 'Miscellaneous', priority: 'optional', bag: T, rule: none },
  { name: 'Sleeping bag', category: 'Miscellaneous', priority: 'optional', bag: T, rule: none }
];

export function findCatalog(name: string): CatItem | undefined {
  const n = name.trim().toLowerCase();
  return CATALOG.find((c) => c.name.toLowerCase() === n);
}

export function searchCatalog(q: string): CatItem[] {
  const s = q.trim().toLowerCase();
  if (!s) return CATALOG;
  return CATALOG.filter((c) => c.name.toLowerCase().includes(s) || c.category.toLowerCase().includes(s));
}
