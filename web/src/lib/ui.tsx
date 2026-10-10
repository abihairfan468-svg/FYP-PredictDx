import { createContext, ReactNode, useCallback, useContext, useEffect, useRef, useState } from 'react';

/* ============================== ICONS ============================== */
const IP: Record<string, string> = {
  home: 'M3 11l9-8 9 8v9a2 2 0 0 1-2 2h-4v-6H9v6H5a2 2 0 0 1-2-2z',
  cal: 'M4 6h16v15H4z M8 3v5 M16 3v5 M4 11h16',
  search: 'M11 4a7 7 0 1 0 0 14 7 7 0 0 0 0-14z M20.5 20.5l-4.6-4.6',
  user: 'M12 12a4 4 0 1 0 0-8 4 4 0 0 0 0 8z M4 21c0-4 3.6-6 8-6s8 2 8 6',
  users: 'M9 11a4 4 0 1 0 0-8 4 4 0 0 0 0 8z M2 21c0-3.5 3-5.5 7-5.5s7 2 7 5.5 M16 3.5a4 4 0 0 1 0 7.5 M18 15.5c2.4.6 4 2.4 4 5.5',
  file: 'M6 2h8l4 4v16H6z M14 2v5h5',
  chat: 'M4 5h16v11H9l-5 4z',
  act: 'M3 12h4l3 8 4-16 3 8h4',
  shield: 'M12 3l8 3v6c0 5-3.4 8.4-8 9-4.6-.6-8-4-8-9V6z',
  db: 'M12 3c4.4 0 8 1.3 8 3s-3.6 3-8 3-8-1.3-8-3 3.6-3 8-3z M4 6v12c0 1.7 3.6 3 8 3s8-1.3 8-3V6 M4 12c0 1.7 3.6 3 8 3s8-1.3 8-3',
  scan: 'M4 8V5a1 1 0 0 1 1-1h3 M16 4h3a1 1 0 0 1 1 1v3 M20 16v3a1 1 0 0 1-1 1h-3 M8 20H5a1 1 0 0 1-1-1v-3 M4 12h16',
  stet: 'M6 3v5a4 4 0 0 0 8 0V3 M10 15v1a5 5 0 0 0 10 0v-2 M20 10a2 2 0 1 0 0 4 2 2 0 0 0 0-4z M10 12v3',
  card: 'M3 6h18v12H3z M3 10h18 M7 15h4',
  chart: 'M4 20V10 M10 20V4 M16 20v-7 M22 20H2',
  flow: 'M5 4h6v5H5z M13 15h6v5h-6z M8 9v6h5',
  phone: 'M8 2h8a2 2 0 0 1 2 2v16a2 2 0 0 1-2 2H8a2 2 0 0 1-2-2V4a2 2 0 0 1 2-2z M11 19h2',
  lock: 'M6 11h12v10H6z M9 11V8a3 3 0 0 1 6 0v3',
  key: 'M15 7a4 4 0 1 1-3.4 6.1L4 20.5V17h3v-3h3l1.6-1.6A4 4 0 0 1 15 7z M16.5 8.5h.01',
  check: 'M5 13l4 4L19 7',
  alert: 'M12 4l9 16H3z M12 10v4 M12 17h.01',
  clock: 'M12 3a9 9 0 1 0 0 18 9 9 0 0 0 0-18z M12 7v5l3 2',
  dl: 'M12 4v11 M8 11l4 4 4-4 M5 20h14',
  up: 'M12 20V9 M8 13l4-4 4 4 M5 4h14',
  share: 'M6 15a3 3 0 1 0 0-6 3 3 0 0 0 0 6z M18 9a3 3 0 1 0 0-6 3 3 0 0 0 0 6z M18 21a3 3 0 1 0 0-6 3 3 0 0 0 0 6z M8.6 10.6l6.8-3.4 M8.6 13.4l6.8 3.4',
  plus: 'M12 5v14 M5 12h14',
  x: 'M6 6l12 12 M18 6L6 18',
  chev: 'M9 6l6 6-6 6',
  back: 'M15 6l-6 6 6 6',
  sun: 'M12 8a4 4 0 1 0 0 8 4 4 0 0 0 0-8z M12 2v2 M12 20v2 M2 12h2 M20 12h2 M4.9 4.9l1.4 1.4 M17.7 17.7l1.4 1.4 M4.9 19.1l1.4-1.4 M17.7 6.3l1.4-1.4',
  moon: 'M20 14.5A8.5 8.5 0 1 1 9.5 4a7 7 0 0 0 10.5 10.5z',
  pill: 'M10.5 20.5a4.95 4.95 0 0 1-7-7l7-7a4.95 4.95 0 0 1 7 7z M7 10l7 7',
  filter: 'M4 5h16l-6 7v7l-4-2v-5z',
  bell: 'M6 9a6 6 0 1 1 12 0c0 5 2 6 2 6H4s2-1 2-6z M10 21h4',
  out: 'M9 21H5a2 2 0 0 1-2-2V5a2 2 0 0 1 2-2h4 M16 17l5-5-5-5 M21 12H9',
  send: 'M4 12l16-8-6 16-3-7z',
  eye: 'M2 12s3.5-7 10-7 10 7 10 7-3.5 7-10 7S2 12 2 12z M12 9a3 3 0 1 0 0 6 3 3 0 0 0 0-6z',
  eyeoff: 'M3 3l18 18 M10.6 5.1A10 10 0 0 1 12 5c6.5 0 10 7 10 7a17 17 0 0 1-3 3.9 M6.6 6.6C3.9 8.4 2 12 2 12s3.5 7 10 7a9.7 9.7 0 0 0 5.4-1.6 M9.9 9.9a3 3 0 0 0 4.2 4.2',
  mail: 'M3 5h18v14H3z M3 6l9 7 9-7',
  device: 'M3 5h18v11H3z M8 20h8 M12 16v4',
  lungs: 'M12 3v7 M12 10c0 4.5-2.3 8-6 8-1.3 0-2.2-.8-2.2-2.2 0-3.8 1.6-7.4 4.2-9.4 M12 10c0 4.5 2.3 8 6 8 1.3 0 2.2-.8 2.2-2.2 0-3.8-1.6-7.4-4.2-9.4',
  wallet: 'M3 7h16a2 2 0 0 1 2 2v9a2 2 0 0 1-2 2H3z M3 7l12-4v4 M16 13.5h.01',
  refresh: 'M20 11a8 8 0 1 0-2.3 5.7 M20 4v7h-7',
  bot: 'M7 8h10a3 3 0 0 1 3 3v6a3 3 0 0 1-3 3H7a3 3 0 0 1-3-3v-6a3 3 0 0 1 3-3z M12 4v4 M9 14h.01 M15 14h.01',
};

export function Icon({ n, s = 18, w = 1.9 }: { n: string; s?: number; w?: number }) {
  return (
    <svg width={s} height={s} viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth={w} strokeLinecap="round" strokeLinejoin="round" aria-hidden="true">
      <path d={IP[n] ?? IP.home} />
    </svg>
  );
}

/** The PredictDx asterisk mark from the Canva cover. */
export function Mark({ s = 22, color = 'var(--primary-blue)' }: { s?: number; color?: string }) {
  return (
    <svg width={s} height={s} viewBox="0 0 64 64" aria-hidden="true">
      <g stroke={color} strokeWidth="7" strokeLinecap="round">
        <path d="M32 6v52" /><path d="M6 32h52" /><path d="M13.6 13.6l36.8 36.8" /><path d="M50.4 13.6L13.6 50.4" />
      </g>
      <circle cx="32" cy="32" r="7.5" fill={color} />
    </svg>
  );
}

export const initials = (name: string) =>
  name
    .replace(/^Dr\.?\s+/i, '')
    .split(/\s+/)
    .slice(0, 2)
    .map((p) => p[0]?.toUpperCase() ?? '')
    .join('');

export function Avatar({ name, size = 40, cls = '' }: { name: string; size?: number; cls?: string }) {
  return (
    <span className={`av ${cls}`} style={{ width: size, height: size, fontSize: Math.round(size * 0.36) }}>
      {initials(name)}
    </span>
  );
}

/* ============================== FORMATTING ============================== */
export const fmtTime = (d: string | Date) => new Date(d).toLocaleTimeString('en-US', { hour: 'numeric', minute: '2-digit' }).toLowerCase();
export const fmtDate = (d: string | Date) => new Date(d).toLocaleDateString('en-GB', { day: '2-digit', month: 'short', year: 'numeric' });
export const fmtDay = (d: string | Date) => {
  const x = new Date(d);
  const t = new Date();
  const diff = Math.round((new Date(x.getFullYear(), x.getMonth(), x.getDate()).getTime() - new Date(t.getFullYear(), t.getMonth(), t.getDate()).getTime()) / 86_400_000);
  if (diff === 0) return 'Today';
  if (diff === 1) return 'Tomorrow';
  if (diff === -1) return 'Yesterday';
  return x.toLocaleDateString('en-GB', { weekday: 'short', day: '2-digit', month: 'short' });
};
export const fmtWhen = (d: string | Date) => `${fmtDay(d)} · ${fmtTime(d)}`;
export const ago = (d: string | Date) => {
  const s = Math.round((Date.now() - new Date(d).getTime()) / 1000);
  if (s < 45) return 'just now';
  if (s < 3600) return `${Math.round(s / 60)} min ago`;
  if (s < 86_400) return `${Math.round(s / 3600)} h ago`;
  return `${Math.round(s / 86_400)} d ago`;
};
export const rs = (n: number) => `Rs ${n.toLocaleString()}`;
export const bandTone = (b: string) => (b === 'High' ? 'crit' : b === 'Medium' ? 'warn' : 'ok');

/* ============================== TOASTS ============================== */
type ToastKind = 'ok' | 'err' | 'dev';
interface Toast { id: number; msg: string; kind: ToastKind }
const ToastCtx = createContext<(msg: string, kind?: ToastKind) => void>(() => {});

export function ToastProvider({ children }: { children: ReactNode }) {
  const [items, setItems] = useState<Toast[]>([]);
  const id = useRef(0);
  const push = useCallback((msg: string, kind: ToastKind = 'ok') => {
    const t = { id: ++id.current, msg, kind };
    setItems((l) => [...l.slice(-3), t]);
    setTimeout(() => setItems((l) => l.filter((x) => x.id !== t.id)), kind === 'dev' ? 9000 : 3800);
  }, []);
  return (
    <ToastCtx.Provider value={push}>
      {children}
      <div className="toasts" aria-live="polite">
        {items.map((t) => (
          <div key={t.id} className={`toast ${t.kind}`}>
            <span className="dot" style={{ marginTop: 5, background: t.kind === 'err' ? 'var(--crit)' : t.kind === 'dev' ? 'var(--lime)' : 'var(--ok)' }} />
            <span>{t.msg}</span>
          </div>
        ))}
      </div>
    </ToastCtx.Provider>
  );
}
export const useToast = () => useContext(ToastCtx);

/* ============================== THEME ============================== */
type Theme = 'light' | 'dark';
const THEME_KEY = 'predictdx-theme';

/** Light by default; the viewer's choice is remembered in this browser. */
export function initialTheme(): Theme {
  try {
    return localStorage.getItem(THEME_KEY) === 'dark' ? 'dark' : 'light';
  } catch {
    return 'light';
  }
}

/** Sun/moon button that switches between the light and dark theme. */
export function ThemeToggle() {
  const [theme, setTheme] = useState<Theme>(() => (document.documentElement.getAttribute('data-theme') === 'dark' ? 'dark' : 'light'));
  const flip = () => {
    const next: Theme = theme === 'dark' ? 'light' : 'dark';
    document.documentElement.setAttribute('data-theme', next);
    try {
      localStorage.setItem(THEME_KEY, next);
    } catch {
      /* private mode: the choice just isn't remembered */
    }
    setTheme(next);
  };
  const label = theme === 'dark' ? 'Switch to light mode' : 'Switch to dark mode';
  return (
    <button type="button" className="ibtn theme-btn" onClick={flip} aria-label={label} title={label}>
      <Icon n={theme === 'dark' ? 'sun' : 'moon'} s={17} />
    </button>
  );
}

/** Shows the one-time code in development builds (OTP_DEV_ECHO=true on the API). */
export function useDevCode() {
  const toast = useToast();
  return (code?: string) => {
    if (code) toast(`Verification code: ${code}`, 'dev');
  };
}

/* ============================== MODAL ============================== */
export function Modal({ title, eyebrow, onClose, children, wide }: { title: string; eyebrow?: string; onClose: () => void; children: ReactNode; wide?: boolean }) {
  useEffect(() => {
    const k = (e: KeyboardEvent) => e.key === 'Escape' && onClose();
    document.addEventListener('keydown', k);
    return () => document.removeEventListener('keydown', k);
  }, [onClose]);
  return (
    <div className="scrim" onMouseDown={(e) => e.target === e.currentTarget && onClose()}>
      <div className={`modal${wide ? ' wide-m' : ''}`} role="dialog" aria-modal="true" aria-label={title}>
        <div className="between" style={{ alignItems: 'flex-start' }}>
          <div>
            {eyebrow && <div className="eyebrow" style={{ color: 'var(--brand)' }}>{eyebrow}</div>}
            <h3 style={{ fontSize: 19, fontWeight: 800, marginTop: eyebrow ? 5 : 0 }}>{title}</h3>
          </div>
          <button className="ibtn" onClick={onClose} aria-label="Close"><Icon n="x" s={16} /></button>
        </div>
        <div style={{ height: 14 }} />
        {children}
      </div>
    </div>
  );
}

/* ============================== PAGE PIECES ============================== */
/** The light-blue title band from the Smart Diagnostic Center design. */
export function Band({ title, sub, art, right }: { title: string; sub?: string; art?: string; right?: ReactNode }) {
  return (
    <section className="band">
      {art && <div className="art" style={{ backgroundImage: `url(${art})` }} />}
      <div style={{ position: 'relative', flex: 1, minWidth: 0 }}>
        <h1>{title}</h1>
        {sub && <p className="sub">{sub}</p>}
      </div>
      {right && <div style={{ position: 'relative' }}>{right}</div>}
    </section>
  );
}

export function Stat({ label, value, sub, icon, tone = 'brand', small }: { label: string; value: ReactNode; sub?: ReactNode; icon: string; tone?: 'brand' | 'ok' | 'warn' | 'crit' | 'lime'; small?: boolean }) {
  const bg = { brand: 'var(--brand-soft)', ok: 'var(--ok-soft)', warn: 'var(--warn-soft)', crit: 'var(--crit-soft)', lime: 'var(--lime-soft)' }[tone];
  const fg = { brand: 'var(--brand)', ok: 'var(--ok)', warn: 'var(--warn)', crit: 'var(--crit)', lime: 'var(--lime)' }[tone];
  return (
    <div className="stat">
      <div className="ctr" style={{ alignItems: 'flex-start', gap: 12 }}>
        <span className="ic" style={{ background: bg, color: fg }}><Icon n={icon} s={18} /></span>
        <span className="grow">
          <span className="eyebrow">{label}</span>
          <div className={`big${small ? ' sm' : ''}`}>{value}</div>
          {sub && <div className="tiny" style={{ marginTop: 3 }}>{sub}</div>}
        </span>
      </div>
    </div>
  );
}

export function Head({ title, sub, right }: { title: ReactNode; sub?: ReactNode; right?: ReactNode }) {
  return (
    <div className="between" style={{ alignItems: 'flex-start' }}>
      <div>
        <div className="h-sec">{title}</div>
        {sub && <div className="h-sub" style={{ marginTop: 2 }}>{sub}</div>}
      </div>
      {right}
    </div>
  );
}

export function Empty({ icon, title, children }: { icon: string; title: string; children?: ReactNode }) {
  return (
    <div className="empty">
      <Icon n={icon} s={26} />
      <b>{title}</b>
      <div className="tiny">{children}</div>
    </div>
  );
}

/** Loads data on mount / when deps change, with a reload handle. */
export function useLoad<T>(fn: () => Promise<T>, deps: unknown[] = []) {
  const [data, setData] = useState<T | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [loading, setLoading] = useState(true);
  const seq = useRef(0);
  const load = useCallback(() => {
    const n = ++seq.current;
    setLoading(true);
    return fn()
      .then((d) => {
        if (n === seq.current) {
          setData(d);
          setError(null);
        }
      })
      .catch((e) => n === seq.current && setError(e.message))
      .finally(() => n === seq.current && setLoading(false));
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, deps);
  useEffect(() => {
    load();
  }, [load]);
  return { data, setData, error, loading, reload: load };
}
