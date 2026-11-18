import { createContext, useCallback, useContext, useEffect, useMemo, useRef, useState, type ReactNode } from 'react';
import { Icon } from './icons';
import type { Trip } from '../types';

/* ---------------- basic building blocks ---------------- */

export function Card({ children, className = '', onClick }: { children: ReactNode; className?: string; onClick?: () => void }) {
  const Tag = onClick ? 'button' : 'div';
  return (
    <Tag onClick={onClick} className={`bg-white rounded-2xl shadow-card text-left w-full ${onClick ? 'active:scale-[.99] transition' : ''} ${className}`}>
      {children}
    </Tag>
  );
}

type BtnProps = React.ButtonHTMLAttributes<HTMLButtonElement> & { variant?: 'primary' | 'secondary' | 'ghost' | 'danger'; icon?: string; full?: boolean; small?: boolean };
export function Button({ variant = 'primary', icon, full, small, className = '', children, ...p }: BtnProps) {
  const base = 'inline-flex items-center justify-center gap-2 font-semibold rounded-xl transition disabled:opacity-50 disabled:pointer-events-none';
  const size = small ? 'h-9 px-3 text-sm' : 'h-12 px-5 text-[15px]';
  const v = {
    primary: 'bg-teal text-white shadow-sm active:bg-teal-600',
    secondary: 'bg-white text-navy border border-slate-200 active:bg-slate-50',
    ghost: 'text-teal active:bg-teal-50',
    danger: 'bg-danger text-white active:opacity-90'
  }[variant];
  return (
    <button className={`${base} ${size} ${v} ${full ? 'w-full' : ''} ${className}`} {...p}>
      {icon && <Icon name={icon} size={small ? 16 : 18} />}
      {children}
    </button>
  );
}

export function IconButton({ icon, label, onClick, className = '', disabled }: { icon: string; label: string; onClick?: () => void; className?: string; disabled?: boolean }) {
  return (
    <button aria-label={label} title={label} disabled={disabled} onClick={onClick}
      className={`h-10 w-10 grid place-items-center rounded-full text-navy active:bg-black/5 disabled:opacity-40 ${className}`}>
      <Icon name={icon} size={20} />
    </button>
  );
}

export function Chip({ children, active, onClick, tone = 'default' }: { children: ReactNode; active?: boolean; onClick?: () => void; tone?: 'default' | 'ok' | 'warn' | 'danger' | 'soon' }) {
  const t = {
    default: active ? 'bg-navy text-white' : 'bg-white text-navy border border-slate-200',
    ok: 'bg-teal-50 text-teal-600', warn: 'bg-amber-50 text-amber-700', danger: 'bg-red-50 text-danger', soon: 'bg-slate-100 text-slate2'
  }[tone];
  const cls = `inline-flex items-center gap-1 rounded-full px-3 h-8 text-[13px] font-semibold whitespace-nowrap ${t}`;
  return onClick ? <button onClick={onClick} className={cls}>{children}</button> : <span className={cls}>{children}</span>;
}

export function ProgressBar({ value, className = '', tone = 'teal' }: { value: number; className?: string; tone?: 'teal' | 'warn' }) {
  return (
    <div className={`h-2 rounded-full bg-slate-200/80 overflow-hidden ${className}`} role="progressbar" aria-valuenow={value} aria-valuemin={0} aria-valuemax={100}>
      <div className={`h-full rounded-full transition-all duration-300 ${tone === 'warn' ? 'bg-warn' : 'bg-teal'}`} style={{ width: `${value}%` }} />
    </div>
  );
}

export function Ring({ value, size = 64 }: { value: number; size?: number }) {
  const r = (size - 10) / 2, c = 2 * Math.PI * r;
  return (
    <div className="relative shrink-0" style={{ width: size, height: size }} aria-label={`${value}% packed`}>
      <svg width={size} height={size} className="-rotate-90">
        <circle cx={size / 2} cy={size / 2} r={r} stroke="#E4EBF1" strokeWidth="8" fill="none" />
        <circle cx={size / 2} cy={size / 2} r={r} stroke="#0D9488" strokeWidth="8" fill="none" strokeLinecap="round"
          strokeDasharray={c} strokeDashoffset={c - (c * value) / 100} style={{ transition: 'stroke-dashoffset .3s' }} />
      </svg>
      <span className="absolute inset-0 grid place-items-center text-sm font-extrabold">{value}%</span>
    </div>
  );
}

export function Stepper({ value, onChange, min = 1, max = 99 }: { value: number; onChange: (n: number) => void; min?: number; max?: number }) {
  return (
    <div className="inline-flex items-center rounded-xl border border-slate-200 bg-white">
      <button aria-label="Decrease quantity" className="h-9 w-9 grid place-items-center disabled:opacity-30" disabled={value <= min} onClick={() => onChange(value - 1)}><Icon name="Minus" size={16} /></button>
      <span className="w-8 text-center text-sm font-bold tabular-nums" aria-live="polite">{value}</span>
      <button aria-label="Increase quantity" className="h-9 w-9 grid place-items-center disabled:opacity-30" disabled={value >= max} onClick={() => onChange(value + 1)}><Icon name="Plus" size={16} /></button>
    </div>
  );
}

export function Field({ label, children, hint }: { label: string; children: ReactNode; hint?: string }) {
  return (
    <label className="block">
      <span className="block text-[13px] font-semibold text-slate2 mb-1.5">{label}</span>
      {children}
      {hint && <span className="block text-xs text-slate2 mt-1">{hint}</span>}
    </label>
  );
}
const inputCls = 'w-full h-12 rounded-xl border border-slate-200 bg-white px-3.5 text-base focus:border-teal';
export const Input = (p: React.InputHTMLAttributes<HTMLInputElement>) => <input {...p} className={`${inputCls} ${p.className ?? ''}`} />;
export const Select = (p: React.SelectHTMLAttributes<HTMLSelectElement>) => <select {...p} className={`${inputCls} ${p.className ?? ''}`} />;
export const Textarea = (p: React.TextareaHTMLAttributes<HTMLTextAreaElement>) => (
  <textarea {...p} className={`w-full rounded-xl border border-slate-200 bg-white p-3.5 text-base focus:border-teal ${p.className ?? ''}`} />
);

export function EmptyState({ icon, title, body, action }: { icon: string; title: string; body: string; action?: ReactNode }) {
  return (
    <div className="text-center py-10 px-6">
      <div className="mx-auto h-20 w-20 rounded-3xl bg-teal-50 text-teal grid place-items-center mb-4"><Icon name={icon} size={36} /></div>
      <h3 className="text-lg font-extrabold">{title}</h3>
      <p className="text-slate2 text-sm mt-1 mb-5 max-w-xs mx-auto">{body}</p>
      {action}
    </div>
  );
}

export function TopBar({ title, back, right, sub }: { title: string; back?: string | (() => void); right?: ReactNode; sub?: string }) {
  return (
    <header className="sticky top-0 z-20 bg-mist/90 backdrop-blur safe-t">
      <div className="h-14 px-2 flex items-center gap-1 max-w-2xl mx-auto">
        {back ? (
          <IconButton icon="ChevronLeft" label="Back" onClick={() => (typeof back === 'function' ? back() : (window.location.hash = '#' + back))} />
        ) : <span className="w-3" />}
        <div className="flex-1 min-w-0">
          <h1 className="text-[17px] font-extrabold truncate">{title}</h1>
          {sub && <p className="text-xs text-slate2 -mt-0.5 truncate">{sub}</p>}
        </div>
        {right}
      </div>
    </header>
  );
}

/* ---------------- trip cover ---------------- */

const TONES = ['from-navy to-teal', 'from-navy to-sky-600', 'from-teal to-navy', 'from-navy to-emerald-600'];
const TYPE_ICON: Record<string, string> = { vacation: 'Palmtree', business: 'Briefcase', wedding: 'Heart', adventure: 'Mountain', medical: 'BriefcaseMedical', other: 'Map' };

export function tripTone(t: Pick<Trip, 'destination' | 'name'>): string {
  let h = 0;
  for (const ch of (t.destination || t.name)) h = (h * 31 + ch.charCodeAt(0)) >>> 0;
  return TONES[h % TONES.length];
}

export function TripCover({ trip, className = '', children }: { trip: Pick<Trip, 'cover_image' | 'destination' | 'name' | 'trip_type'>; className?: string; children?: ReactNode }) {
  return (
    <div className={`relative overflow-hidden bg-gradient-to-br ${tripTone(trip)} ${className}`}
      style={trip.cover_image ? { backgroundImage: `url(${trip.cover_image})`, backgroundSize: 'cover', backgroundPosition: 'center' } : undefined}>
      {!trip.cover_image && <Icon name={TYPE_ICON[trip.trip_type] ?? 'Map'} size={120} className="absolute -right-4 -bottom-4 text-white/20" />}
      {trip.cover_image && <div className="absolute inset-0 bg-gradient-to-t from-black/60 via-black/10 to-transparent" />}
      <div className="relative h-full">{children}</div>
    </div>
  );
}

/* ---------------- sheet / confirm / toast ---------------- */

export function Sheet({ open, onClose, title, children, tall }: { open: boolean; onClose: () => void; title: string; children: ReactNode; tall?: boolean }) {
  useEffect(() => {
    if (!open) return;
    const k = (e: KeyboardEvent) => e.key === 'Escape' && onClose();
    window.addEventListener('keydown', k);
    return () => window.removeEventListener('keydown', k);
  }, [open, onClose]);
  if (!open) return null;
  return (
    <div className="fixed inset-0 z-50 flex items-end sm:items-center justify-center" role="dialog" aria-modal="true" aria-label={title}>
      <div className="absolute inset-0 bg-navy/40 anim-fade" onClick={onClose} />
      <div className={`relative bg-white w-full max-w-lg rounded-t-3xl sm:rounded-3xl anim-up flex flex-col ${tall ? 'h-[88%]' : 'max-h-[88%]'} safe-b`}>
        <div className="flex items-center px-5 pt-4 pb-2">
          <h2 className="flex-1 text-lg font-extrabold">{title}</h2>
          <IconButton icon="X" label="Close" onClick={onClose} />
        </div>
        <div className="px-5 pb-4 overflow-y-auto flex-1">{children}</div>
      </div>
    </div>
  );
}

interface ConfirmOpts { title: string; body?: string; confirmLabel?: string; danger?: boolean }
interface Toast { id: number; msg: string; action?: { label: string; run: () => void } }
interface UiCtx { toast: (msg: string, action?: Toast['action']) => void; confirm: (o: ConfirmOpts) => Promise<boolean> }
const Ctx = createContext<UiCtx>({ toast: () => undefined, confirm: async () => false });
export const useUi = () => useContext(Ctx);

export function UiProvider({ children }: { children: ReactNode }) {
  const [toasts, setToasts] = useState<Toast[]>([]);
  const [dlg, setDlg] = useState<(ConfirmOpts & { resolve: (v: boolean) => void }) | null>(null);
  const seq = useRef(0);
  const toast = useCallback((msg: string, action?: Toast['action']) => {
    const id = ++seq.current;
    setToasts((t) => [...t.slice(-2), { id, msg, action }]);
    setTimeout(() => setToasts((t) => t.filter((x) => x.id !== id)), action ? 6000 : 2600);
  }, []);
  const confirm = useCallback((o: ConfirmOpts) => new Promise<boolean>((resolve) => setDlg({ ...o, resolve })), []);
  const value = useMemo(() => ({ toast, confirm }), [toast, confirm]);
  const close = (v: boolean) => { dlg?.resolve(v); setDlg(null); };
  return (
    <Ctx.Provider value={value}>
      {children}
      <div className="fixed left-0 right-0 bottom-24 z-[60] flex flex-col items-center gap-2 px-4 pointer-events-none" aria-live="polite">
        {toasts.map((t) => (
          <div key={t.id} className="pointer-events-auto anim-up bg-navy text-white text-sm rounded-xl pl-4 pr-2 py-2 shadow-lg flex items-center gap-3 max-w-sm">
            <span>{t.msg}</span>
            {t.action && <button className="font-bold text-teal-50 bg-white/10 rounded-lg px-3 h-8" onClick={() => { t.action!.run(); setToasts((x) => x.filter((y) => y.id !== t.id)); }}>{t.action.label}</button>}
          </div>
        ))}
      </div>
      {dlg && (
        <div className="fixed inset-0 z-[70] grid place-items-center p-6" role="alertdialog" aria-modal="true" aria-label={dlg.title}>
          <div className="absolute inset-0 bg-navy/50 anim-fade" onClick={() => close(false)} />
          <div className="relative bg-white rounded-3xl p-6 max-w-sm w-full anim-up">
            <h3 className="text-lg font-extrabold">{dlg.title}</h3>
            {dlg.body && <p className="text-sm text-slate2 mt-1.5">{dlg.body}</p>}
            <div className="flex gap-3 mt-5">
              <Button variant="secondary" full onClick={() => close(false)}>Cancel</Button>
              <Button variant={dlg.danger ? 'danger' : 'primary'} full onClick={() => close(true)}>{dlg.confirmLabel ?? 'Confirm'}</Button>
            </div>
          </div>
        </div>
      )}
    </Ctx.Provider>
  );
}
