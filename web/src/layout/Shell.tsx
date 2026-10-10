import { createContext, ReactNode, useCallback, useContext, useEffect, useState } from 'react';
import { Link, NavLink, Outlet, useLocation, useNavigate } from 'react-router-dom';
import { api } from '../lib/api';
import { useAuth } from '../lib/auth';
import { useSocket, useSocketEvent } from '../lib/socket';
import { ago, Avatar, Icon, Mark, Modal, ThemeToggle, useToast } from '../lib/ui';

export type Role = 'PATIENT' | 'DOCTOR' | 'ADMIN';
export interface NavItem { path: string; label: string; icon: string; roles: Role[] }

export const NAV: NavItem[] = [
  { path: '/app/portal', label: 'My Health Portal', icon: 'search', roles: ['PATIENT'] },
  { path: '/app/workspace', label: 'Doctor Workspace', icon: 'stet', roles: ['DOCTOR'] },
  { path: '/app/admin', label: 'System Management', icon: 'shield', roles: ['ADMIN'] },
  { path: '/app/diagnosis', label: 'Diagnosis Center', icon: 'scan', roles: ['DOCTOR', 'ADMIN'] },
  { path: '/app/central', label: 'Central Records', icon: 'db', roles: ['ADMIN'] },
  { path: '/app/records', label: 'Reports & Records', icon: 'file', roles: ['PATIENT', 'DOCTOR', 'ADMIN'] },
  { path: '/app/careconnect', label: 'CareConnect', icon: 'chat', roles: ['PATIENT', 'DOCTOR'] },
  { path: '/app/journey', label: 'Health Journey', icon: 'act', roles: ['PATIENT', 'DOCTOR'] },
  { path: '/app/account', label: 'Account & Security', icon: 'lock', roles: ['PATIENT', 'DOCTOR', 'ADMIN'] },
];
const ROLE_LABEL: Record<Role, string> = { PATIENT: 'Patient portal', DOCTOR: 'Doctor workspace', ADMIN: 'Admin console' };

/* ============================== notifications (shared with CareConnect) ============================== */
export interface Notif { id: string; type: string; title: string; body: string; link: string | null; readAt: string | null; createdAt: string }
interface NotifState { items: Notif[]; unread: number; readAll: () => Promise<void>; open: (n: Notif) => void }
const NotifCtx = createContext<NotifState>(null!);
export const useNotifications = () => useContext(NotifCtx);

function NotificationsProvider({ children }: { children: ReactNode }) {
  const [items, setItems] = useState<Notif[]>([]);
  const toast = useToast();
  const nav = useNavigate();
  useEffect(() => {
    api<Notif[]>('/notifications').then(setItems).catch(() => null);
  }, []);
  useSocketEvent<Notif>('notification', (n) => {
    setItems((l) => [n, ...l]);
    toast(`${n.title} — ${n.body}`);
  });
  const readAll = useCallback(async () => {
    await api('/notifications/read-all', { method: 'POST' });
    setItems((l) => l.map((n) => ({ ...n, readAt: n.readAt ?? new Date().toISOString() })));
  }, []);
  const open = useCallback((n: Notif) => {
    if (!n.readAt) {
      api(`/notifications/${n.id}/read`, { method: 'PATCH' }).catch(() => null);
      setItems((l) => l.map((x) => (x.id === n.id ? { ...x, readAt: new Date().toISOString() } : x)));
    }
    if (n.link) nav(n.link);
  }, [nav]);
  return <NotifCtx.Provider value={{ items, unread: items.filter((n) => !n.readAt).length, readAll, open }}>{children}</NotifCtx.Provider>;
}

export const NOTIF_ICON: Record<string, string> = {
  'appointment.confirmed': 'cal', 'appointment.new': 'cal', 'appointment.cancelled': 'cal', 'appointment.rescheduled': 'cal', 'appointment.reminder': 'clock',
  'prescription.signed': 'pill', 'report.ready': 'scan', 'chat.message': 'chat', 'chat.escalation': 'bot', 'visit.called': 'stet', 'visit.completed': 'check',
  'doctor.pending': 'shield', 'account.approved': 'check',
};

/* ============================== shell ============================== */
export default function Shell() {
  return (
    <NotificationsProvider>
      <ShellInner />
    </NotificationsProvider>
  );
}

function ShellInner() {
  const { user, signOut } = useAuth();
  const { connected } = useSocket();
  const notif = useNotifications();
  const loc = useLocation();
  const nav = useNavigate();
  const [bell, setBell] = useState(false);

  if (!user) return null;
  const mine = NAV.filter((n) => n.roles.includes(user.role));
  const current = NAV.find((n) => loc.pathname.startsWith(n.path));

  const link = (n: NavItem) => (
    <NavLink key={n.path} to={n.path} className={({ isActive }) => (isActive ? 'active' : '')}>
      <Icon n={n.icon} s={17} />
      <span>{n.label}</span>
    </NavLink>
  );

  return (
    <div className="shell">
      <nav className="rail" aria-label="Main menu">
        <Link to="/" className="brand">
          <span className="mark"><Mark s={22} color="#fff" /></span>
          <span><b>PredictDx</b><small>{ROLE_LABEL[user.role]}</small></span>
        </Link>
        <div className="navgroup">
          <div className="lbl">Menu</div>
          <div className="nav">{mine.map(link)}</div>
        </div>
        <div style={{ height: 14 }} />
        <div className="whoami">
          <Avatar name={user.fullName} size={36} cls={user.role === 'DOCTOR' ? 'c2' : user.role === 'ADMIN' ? 'c3' : ''} />
          <span className="grow">
            <b>{user.fullName}</b>
            <small>{user.patient?.mrn ?? (user.doctor ? `${user.doctor.specialization} · PMDC ${user.doctor.pmdcNumber}` : 'System administrator')}</small>
          </span>
          <button className="ibtn sm" aria-label="Sign out" title="Sign out" onClick={async () => { await signOut(); nav('/auth'); }}>
            <Icon n="out" s={15} />
          </button>
        </div>
      </nav>

      <div className="main">
        <header className="topbar">
          <div style={{ minWidth: 0 }}>
            <div className="crumb">Home › {current?.label ?? 'Dashboard'}</div>
            <div className="ttl">{current?.label ?? 'PredictDx'}</div>
          </div>
          <span className="grow" />
          <span className={`chip hide-sm ${connected ? 'ok' : 'warn'}`} title={connected ? 'Connected' : 'Reconnecting…'}>
            <span className="dot" style={{ background: connected ? 'var(--ok)' : 'var(--warn)' }} /> {connected ? 'Online' : 'Reconnecting'}
          </span>
          <ThemeToggle />
          <button className="ibtn" aria-label={`Notifications, ${notif.unread} unread`} onClick={() => setBell(true)}>
            <Icon n="bell" s={17} />
            {notif.unread > 0 && <span className="badge" style={{ position: 'absolute', top: -6, right: -6 }}>{notif.unread}</span>}
          </button>
        </header>
        <main className="canvas" tabIndex={-1}>
          <Outlet />
        </main>
      </div>

      <nav className="mobnav" aria-label="Main menu">
        {mine.map((n) => (
          <NavLink key={n.path} to={n.path} className={({ isActive }) => (isActive ? 'active' : '')}>
            <Icon n={n.icon} s={18} />
            <span>{n.label.split(' ')[0]}</span>
          </NavLink>
        ))}
        <a href="#" onClick={async (e) => { e.preventDefault(); await signOut(); nav('/auth'); }}><Icon n="out" s={18} /><span>Sign out</span></a>
      </nav>

      {bell && (
        <Modal title="Notifications" onClose={() => setBell(false)}>
          <NotificationList onPick={() => setBell(false)} />
          <div style={{ height: 14 }} />
          <button className="btn btn-g full" onClick={notif.readAll} disabled={!notif.unread}>Mark all as read</button>
        </Modal>
      )}
    </div>
  );
}

export function NotificationList({ onPick, limit = 30 }: { onPick?: () => void; limit?: number }) {
  const { items, open } = useNotifications();
  if (!items.length) return <div className="tiny" style={{ padding: '16px 0', textAlign: 'center' }}>You are all caught up.</div>;
  return (
    <div className="list">
      {items.slice(0, limit).map((n) => (
        <button key={n.id} className="pick" style={{ opacity: n.readAt ? 0.6 : 1, borderRadius: 0 }} onClick={() => { open(n); onPick?.(); }}>
          <span style={{ width: 32, height: 32, borderRadius: 10, display: 'grid', placeItems: 'center', flexShrink: 0, background: 'var(--brand-soft)', color: 'var(--brand)' }}>
            <Icon n={NOTIF_ICON[n.type] ?? 'bell'} s={15} />
          </span>
          <span className="grow">
            <b style={{ display: 'block', fontSize: 12.5 }}>{n.title}</b>
            <span className="tiny">{n.body}</span>
          </span>
          <span className="tiny" style={{ whiteSpace: 'nowrap' }}>{ago(n.createdAt)}</span>
          {!n.readAt && <span className="dot" style={{ background: 'var(--brand)' }} />}
        </button>
      ))}
    </div>
  );
}
