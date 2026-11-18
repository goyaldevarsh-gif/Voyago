import { Navigate, NavLink, Route, Routes, useLocation, useNavigate } from 'react-router-dom';
import { Icon } from './components/icons';
import { useAuth } from './hooks/auth';
import { useSyncStatus } from './hooks/data';
import Home from './pages/Home';
import Trips from './pages/Trips';
import TripForm from './pages/TripForm';
import TripOverview from './pages/TripOverview';
import Packing from './pages/Packing';
import Notes from './pages/Notes';
import Review from './pages/Review';
import Templates from './pages/Templates';
import TemplateDetail from './pages/TemplateDetail';
import Profile from './pages/Profile';
import Chat from './pages/Chat';
import Itinerary from './pages/Itinerary';
import Bookings from './pages/Bookings';
import Expenses from './pages/Expenses';
import Documents from './pages/Documents';
import Journal from './pages/Journal';
import AuthScreen from './pages/AuthScreen';

const TABS = [
  { to: '/', label: 'Home', icon: 'Home', end: true },
  { to: '/trips', label: 'My Trips', icon: 'Luggage', end: false },
  { to: '/templates', label: 'Templates', icon: 'LayoutTemplate', end: false },
  { to: '/profile', label: 'Profile', icon: 'User', end: false }
];

function SyncBanner() {
  const s = useSyncStatus();
  if (s.status === 'offline') return <div className="bg-amber-50 text-amber-800 text-xs text-center py-1.5 font-semibold">Offline. Changes are saved on this device and will sync later{s.pending ? ` (${s.pending} waiting)` : ''}.</div>;
  if (s.status === 'error') return <div className="bg-red-50 text-danger text-xs text-center py-1.5 font-semibold px-3">Sync problem: {s.error}</div>;
  return null;
}

export default function App() {
  const { phase } = useAuth();
  const loc = useLocation();
  const nav = useNavigate();

  if (phase === 'loading') return <div className="h-full grid place-items-center text-slate2">Loading Voyago…</div>;
  if (phase === 'signedOut') return <AuthScreen />;

  const path = loc.pathname;
  const hideChrome = path === '/trips/new' || /\/edit$/.test(path) || path.startsWith('/chat') || /\/review$/.test(path) || /\/packing$/.test(path) || /^\/templates\/(default|mine)\//.test(path) || /\/(notes|itinerary|bookings|expenses|documents|journal)$/.test(path);
  const hideFab = hideChrome;

  return (
    <div className="min-h-full flex flex-col">
      <SyncBanner />
      <div className="flex-1 w-full max-w-2xl mx-auto pb-28">
        <Routes>
          <Route path="/" element={<Home />} />
          <Route path="/trips" element={<Trips />} />
          <Route path="/trips/new" element={<TripForm />} />
          <Route path="/trips/:id" element={<TripOverview />} />
          <Route path="/trips/:id/edit" element={<TripForm />} />
          <Route path="/trips/:id/packing" element={<Packing />} />
          <Route path="/trips/:id/notes" element={<Notes />} />
          <Route path="/trips/:id/review" element={<Review />} />
          <Route path="/trips/:id/itinerary" element={<Itinerary />} />
          <Route path="/trips/:id/bookings" element={<Bookings />} />
          <Route path="/trips/:id/expenses" element={<Expenses />} />
          <Route path="/trips/:id/documents" element={<Documents />} />
          <Route path="/trips/:id/journal" element={<Journal />} />
          <Route path="/templates" element={<Templates />} />
          <Route path="/templates/default/:key" element={<TemplateDetail kind="default" />} />
          <Route path="/templates/mine/:key" element={<TemplateDetail kind="mine" />} />
          <Route path="/profile" element={<Profile />} />
          <Route path="/chat" element={<Chat />} />
          <Route path="/chat/:tripId" element={<Chat />} />
          <Route path="*" element={<Navigate to="/" replace />} />
        </Routes>
      </div>

      {!hideFab && (
        <button onClick={() => nav(/^\/trips\/[^/]+/.test(path) && !/\/new$/.test(path) ? `/chat/${path.split('/')[2]}` : '/chat')}
          aria-label="Ask Voyago AI"
          className="fixed z-30 right-4 bottom-24 h-14 pl-4 pr-5 rounded-full bg-navy text-white shadow-lg flex items-center gap-2 font-bold active:scale-95 transition">
          <Icon name="Sparkles" size={20} className="text-teal-50" /> Ask Voyago
        </button>
      )}

      {!hideChrome && (
        <nav className="fixed bottom-0 inset-x-0 z-30 bg-white/95 backdrop-blur border-t border-slate-200 safe-b" aria-label="Main">
          <div className="max-w-2xl mx-auto grid grid-cols-4">
            {TABS.map((t) => (
              <NavLink key={t.to} to={t.to} end={t.end}
                className={({ isActive }) => `flex flex-col items-center gap-0.5 pt-2.5 pb-1 text-[11px] font-bold ${isActive ? 'text-teal' : 'text-slate2'}`}>
                <Icon name={t.icon} size={22} />
                {t.label}
              </NavLink>
            ))}
          </div>
        </nav>
      )}
    </div>
  );
}
