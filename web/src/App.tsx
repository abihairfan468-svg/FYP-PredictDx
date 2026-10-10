import { ReactNode } from 'react';
import { Link, Navigate, Route, Routes } from 'react-router-dom';
import { HOME, useAuth } from './lib/auth';
import { Icon } from './lib/ui';
import Shell, { NAV, Role } from './layout/Shell';
import Auth from './pages/Auth';
import Landing from './pages/Landing';
import Portal from './modules/Portal';
import Workspace from './modules/Workspace';
import Diagnosis from './modules/Diagnosis';
import Records from './modules/Records';
import CareConnect from './modules/CareConnect';
import Journey from './modules/Journey';
import SystemManagement from './modules/SystemManagement';
import CentralRecords from './modules/CentralRecords';
import Account from './modules/Account';

function Splash() {
  return (
    <div style={{ minHeight: '100%', display: 'grid', placeItems: 'center' }}>
      <div className="ctr" style={{ color: 'var(--muted)' }}><span className="spin" /> Loading PredictDx…</div>
    </div>
  );
}

/** Client-side role gate. The API enforces the same rules - this only keeps the UI honest. */
function RequireRole({ path, children }: { path: string; children: ReactNode }) {
  const { user } = useAuth();
  const item = NAV.find((n) => n.path === path);
  if (!user) return <Navigate to="/auth" replace />;
  if (item && !item.roles.includes(user.role as Role)) {
    return (
      <div className="card" style={{ maxWidth: 560 }}>
        <div className="ctr" style={{ gap: 12 }}>
          <span className="ibtn" style={{ color: 'var(--crit)' }}><Icon n="lock" /></span>
          <div>
            <div className="h-sec">You don't have access to this page</div>
            <div className="h-sub">{item.label} is only available to {item.roles.map((r) => r.toLowerCase()).join(' and ')} accounts.</div>
          </div>
        </div>
        <Link to={HOME[user.role]} className="btn btn-p sm" style={{ marginTop: 14 }}>Go to my dashboard</Link>
      </div>
    );
  }
  return <>{children}</>;
}

export default function App() {
  const { user, ready } = useAuth();
  if (!ready) return <Splash />;
  const guard = (path: string, el: ReactNode) => <RequireRole path={path}>{el}</RequireRole>;

  return (
    <Routes>
      <Route path="/" element={user ? <Navigate to={HOME[user.role]} replace /> : <Landing />} />
      <Route path="/auth" element={<Auth />} />
      <Route path="/app" element={user ? <Shell /> : <Navigate to="/" replace />}>
        <Route index element={user ? <Navigate to={HOME[user.role]} replace /> : null} />
        <Route path="portal" element={guard('/app/portal', <Portal />)} />
        <Route path="workspace" element={guard('/app/workspace', <Workspace />)} />
        <Route path="diagnosis" element={guard('/app/diagnosis', <Diagnosis />)} />
        <Route path="records" element={guard('/app/records', <Records />)} />
        <Route path="careconnect" element={guard('/app/careconnect', <CareConnect />)} />
        <Route path="journey" element={guard('/app/journey', <Journey />)} />
        <Route path="admin" element={guard('/app/admin', <SystemManagement />)} />
        <Route path="central" element={guard('/app/central', <CentralRecords />)} />
        <Route path="account" element={<Account />} />
        <Route path="*" element={<Navigate to="/app" replace />} />
      </Route>
      <Route path="*" element={<Navigate to="/" replace />} />
    </Routes>
  );
}
