import { FormEvent, useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { api, User } from '../lib/api';
import { useAuth } from '../lib/auth';
import { ago, Avatar, Band, Head, Icon, Modal, useLoad, useToast } from '../lib/ui';
import { OtpInput } from '../pages/Auth';

interface Session { id: string; userAgent: string | null; ip: string | null; createdAt: string; lastUsedAt: string; current: boolean }
const RULE = /^(?=.*[a-z])(?=.*[A-Z])(?=.*\d)(?=.*[^A-Za-z0-9]).{8,72}$/;
const ACTION: Record<string, string> = {
  'auth.login': 'Signed in', 'auth.login.after_verify': 'Signed in after verifying e-mail', 'auth.login_failed': 'Wrong password',
  'auth.mfa_challenge': 'Two-step code requested', 'auth.mfa_failed': 'Wrong two-step code', 'auth.locked': 'Account locked',
  'auth.password_reset': 'Password reset', 'auth.register': 'Account created', 'auth.email_verified': 'E-mail verified',
  'auth.refresh_reuse_detected': 'Stolen-token attempt blocked',
};

const device = (ua: string | null) => {
  if (!ua) return 'Unknown device';
  const b = /Edg\//.test(ua) ? 'Edge' : /Chrome\//.test(ua) ? 'Chrome' : /Firefox\//.test(ua) ? 'Firefox' : /Safari\//.test(ua) ? 'Safari' : /node|curl|supertest/i.test(ua) ? 'Other app' : 'Browser';
  const os = /Windows/.test(ua) ? 'Windows' : /Android/.test(ua) ? 'Android' : /iPhone|iPad/.test(ua) ? 'iOS' : /Mac OS/.test(ua) ? 'macOS' : /Linux/.test(ua) ? 'Linux' : '';
  return `${b}${os ? ' on ' + os : ''}`;
};

export default function Account() {
  const { user, setUser, signOut } = useAuth();
  const toast = useToast();
  const nav = useNavigate();
  const sessions = useLoad(() => api<Session[]>('/account/sessions'), []);
  const activity = useLoad(() => api<{ action: string; ip: string; createdAt: string; detail: string | null }[]>('/account/activity'), []);
  const [p, setP] = useState({ fullName: user!.fullName, phone: user!.phone ?? '', city: user!.patient?.city ?? '' });
  const [pw, setPw] = useState({ current: '', next: '', confirm: '' });
  const [pwErr, setPwErr] = useState<string | null>(null);
  const [totp, setTotp] = useState<{ qr: string; secret: string } | null>(null);
  const [disabling, setDisabling] = useState(false);
  if (!user) return null;

  const saveProfile = async (e: FormEvent) => {
    e.preventDefault();
    try {
      const body: Record<string, string> = { fullName: p.fullName };
      if (p.phone) body.phone = p.phone;
      if (p.city && user.role !== 'ADMIN') body.city = p.city;
      setUser(await api<User>('/account/profile', { method: 'PATCH', body }));
      toast('Profile saved');
    } catch (err) {
      toast((err as Error).message, 'err');
    }
  };

  const changePw = async (e: FormEvent) => {
    e.preventDefault();
    setPwErr(null);
    if (!RULE.test(pw.next)) return setPwErr('New password needs 8+ characters with upper, lower, number and symbol');
    if (pw.next !== pw.confirm) return setPwErr('Passwords do not match');
    try {
      const r = await api<{ otherSessionsEnded: number }>('/account/password', { body: { currentPassword: pw.current, newPassword: pw.next } });
      toast(`Password changed · ${r.otherSessionsEnded} other device${r.otherSessionsEnded === 1 ? '' : 's'} signed out`);
      setPw({ current: '', next: '', confirm: '' });
      sessions.reload();
    } catch (err) {
      setPwErr((err as Error).message);
    }
  };

  const toggleMfa = async () => {
    try {
      setUser(await api<User>('/account/mfa', { body: { enabled: !user.mfaEnabled } }));
      toast(user.mfaEnabled ? 'Two-step sign-in turned off' : 'Two-step sign-in turned on');
    } catch (err) {
      toast((err as Error).message, 'err');
    }
  };

  const endSession = async (s: Session) => {
    await api(`/account/sessions/${s.id}`, { method: 'DELETE' });
    if (s.current) {
      await signOut();
      nav('/auth');
    } else {
      toast('That device has been signed out');
      sessions.reload();
    }
  };

  return (
    <>
      <Band title="Account &amp; security" sub="Manage your profile, password, two-step sign-in and the devices signed in to your account." art="/img/lungs-wide.jpg" />

      <div className="row stack-lg" style={{ alignItems: 'flex-start' }}>
        <div className="col grow">
          <section className="card">
            <Head title="Profile" sub={`${user.role.toLowerCase()} account · ${user.email}`} />
            <div className="ctr" style={{ gap: 14, marginTop: 14 }}>
              <Avatar name={user.fullName} size={56} cls={user.role === 'DOCTOR' ? 'c2' : user.role === 'ADMIN' ? 'c3' : ''} />
              <dl className="kv grow" style={{ gridTemplateColumns: 'repeat(3, minmax(0,1fr))' }}>
                <div><dt>{user.patient ? 'MRN' : user.doctor ? 'PMDC' : 'Role'}</dt><dd className="mono">{user.patient?.mrn ?? user.doctor?.pmdcNumber ?? 'Administrator'}</dd></div>
                <div><dt>Status</dt><dd style={{ color: 'var(--ok)' }}>{user.status}</dd></div>
                <div><dt>Last sign-in</dt><dd>{user.lastLoginAt ? ago(user.lastLoginAt) : '–'}</dd></div>
              </dl>
            </div>
            <form onSubmit={saveProfile} className="col" style={{ gap: 11, marginTop: 16 }}>
              <div className="row wrap" style={{ gap: 10 }}>
                <div className="field grow"><label htmlFor="fn">Full name</label><span className="inp"><input id="fn" value={p.fullName} onChange={(e) => setP({ ...p, fullName: e.target.value })} /></span></div>
                <div className="field grow"><label htmlFor="ph">Phone</label><span className="inp"><input id="ph" value={p.phone} onChange={(e) => setP({ ...p, phone: e.target.value })} placeholder="+92 300 1234567" /></span></div>
                {user.role !== 'ADMIN' && <div className="field grow"><label htmlFor="ct">City</label><span className="inp"><input id="ct" value={p.city} onChange={(e) => setP({ ...p, city: e.target.value })} /></span></div>}
              </div>
              <div><button className="btn btn-p sm">Save profile</button></div>
            </form>
          </section>

          <section className="card">
            <Head title="Change password" sub="Every other device is signed out when you change it." />
            <form onSubmit={changePw} className="col" style={{ gap: 11, marginTop: 14 }}>
              <div className="row wrap" style={{ gap: 10 }}>
                <div className="field grow"><label htmlFor="cp">Current password</label><span className="inp"><input id="cp" type="password" autoComplete="current-password" value={pw.current} onChange={(e) => setPw({ ...pw, current: e.target.value })} /></span></div>
                <div className="field grow"><label htmlFor="np">New password</label><span className="inp"><input id="np" type="password" autoComplete="new-password" value={pw.next} onChange={(e) => setPw({ ...pw, next: e.target.value })} /></span></div>
                <div className="field grow"><label htmlFor="cf">Confirm</label><span className="inp"><input id="cf" type="password" autoComplete="new-password" value={pw.confirm} onChange={(e) => setPw({ ...pw, confirm: e.target.value })} /></span></div>
              </div>
              {pwErr && <div className="notice crit"><Icon n="alert" s={15} /><span>{pwErr}</span></div>}
              <div><button className="btn btn-g sm" disabled={!pw.current || !pw.next}>Change password</button></div>
            </form>
          </section>

          <section className="card">
            <Head title="Signed-in devices" sub="Refresh tokens rotate on every use. Reusing an old one ends every session." right={<span className="chip">{sessions.data?.length ?? 0}</span>} />
            <div className="list" style={{ marginTop: 6 }}>
              {sessions.data?.map((s) => (
                <div key={s.id} className="ctr" style={{ gap: 11 }}>
                  <span className="ibtn sm"><Icon n="device" s={15} /></span>
                  <span className="grow"><b style={{ fontSize: 12.5 }}>{device(s.userAgent)}</b> {s.current && <span className="chip ok" style={{ marginLeft: 6 }}>This device</span>}<div className="tiny">IP {s.ip ?? '–'} · signed in {ago(s.createdAt)} · active {ago(s.lastUsedAt)}</div></span>
                  <button className="btn btn-g xs" onClick={() => endSession(s)}>{s.current ? 'Sign out' : 'Revoke'}</button>
                </div>
              ))}
            </div>
          </section>
        </div>

        <div className="col side-340">
          <section className="card">
            <Head title="Two-step sign-in" sub="A second factor after your password." right={<span className={`chip ${user.mfaEnabled ? 'ok' : 'warn'}`}>{user.mfaEnabled ? 'On' : 'Off'}</span>} />
            <div className="list" style={{ marginTop: 8 }}>
              <div className="ctr" style={{ gap: 11 }}>
                <span className="ibtn sm"><Icon n="mail" s={15} /></span>
                <span className="grow"><b style={{ fontSize: 12.5 }}>E-mail code</b><div className="tiny">6-digit code, 5-minute expiry, 5 attempts</div></span>
                {user.mfaMethod === 'EMAIL' && user.mfaEnabled && <span className="chip ok">In use</span>}
              </div>
              <div className="ctr" style={{ gap: 11 }}>
                <span className="ibtn sm"><Icon n="phone" s={15} /></span>
                <span className="grow"><b style={{ fontSize: 12.5 }}>Authenticator app</b><div className="tiny">Google / Microsoft Authenticator (TOTP)</div></span>
                {user.mfaMethod === 'TOTP' ? (
                  <button className="btn btn-g xs" onClick={() => setDisabling(true)}>Remove</button>
                ) : (
                  <button className="btn btn-s xs" onClick={async () => setTotp(await api('/account/mfa/totp/setup', { body: {} }))}>Set up</button>
                )}
              </div>
            </div>
            {user.mfaMandatory ? (
              <div className="notice info" style={{ marginTop: 10 }}><Icon n="shield" s={15} /><span>Mandatory for {user.role === 'DOCTOR' ? 'doctors' : 'administrators'} — it cannot be switched off.</span></div>
            ) : (
              <button className={`btn ${user.mfaEnabled ? 'btn-g' : 'btn-p'} full sm`} style={{ marginTop: 10 }} onClick={toggleMfa}>
                {user.mfaEnabled ? 'Turn two-step sign-in off' : 'Turn two-step sign-in on'}
              </button>
            )}
          </section>

          <section className="card">
            <Head title="Security activity" sub="Recent sign-in events on your account" />
            <div className="list" style={{ marginTop: 6 }}>
              {activity.data?.map((a, i) => (
                <div key={i} className="ctr" style={{ gap: 9 }}>
                  <span className="dot" style={{ background: /failed|locked|reuse/.test(a.action) ? 'var(--crit)' : 'var(--ok)' }} />
                  <span className="grow" style={{ fontSize: 12, fontWeight: 600, color: 'var(--ink-2)' }}>{ACTION[a.action] ?? a.action}{a.detail ? ` · ${a.detail}` : ''}</span>
                  <span className="tiny">{ago(a.createdAt)}</span>
                </div>
              ))}
            </div>
          </section>

          <section className="card">
            <Head title="How your account is protected" />
            <div className="list" style={{ marginTop: 6 }}>
              {[
                ['lock', 'Protected password', 'Your password is encrypted and never visible to anyone, including staff.'],
                ['key', 'Automatic sign-out', 'Sessions expire automatically and you can sign out any device.'],
                ['shield', 'Lockout after 5 wrong passwords', 'Your account locks for 15 minutes to stop guessing.'],
                ['users', 'Only your care team', 'Doctors can only see patients who have booked them.'],
              ].map(([i, t, d]) => (
                <div key={t} className="ctr" style={{ gap: 10, alignItems: 'flex-start' }}>
                  <span style={{ color: 'var(--brand)' }}><Icon n={i} s={16} /></span>
                  <span><b style={{ fontSize: 12.5 }}>{t}</b><div className="tiny">{d}</div></span>
                </div>
              ))}
            </div>
          </section>
        </div>
      </div>

      {totp && (
        <Modal title="Set up an authenticator app" eyebrow="TWO-STEP SIGN-IN" onClose={() => setTotp(null)}>
          <ol className="tiny" style={{ paddingLeft: 18, lineHeight: 1.7, color: 'var(--ink-2)', margin: 0 }}>
            <li>Open Google Authenticator or Microsoft Authenticator.</li>
            <li>Scan this QR code (or type the key).</li>
            <li>Enter the 6-digit code it shows.</li>
          </ol>
          <div className="ctr" style={{ justifyContent: 'center', margin: '14px 0' }}>
            <img src={totp.qr} alt="QR code for your authenticator app" width={200} height={200} style={{ borderRadius: 12, background: '#fff', padding: 6 }} />
          </div>
          <div className="mono tiny" style={{ textAlign: 'center', wordBreak: 'break-all' }}>{totp.secret}</div>
          <div style={{ height: 14 }} />
          <OtpInput onComplete={async (code) => {
            try {
              setUser(await api<User>('/account/mfa/totp/enable', { body: { code } }));
              toast('Authenticator app is now your second factor');
              setTotp(null);
            } catch (err) {
              toast((err as Error).message, 'err');
            }
          }} />
        </Modal>
      )}
      {disabling && (
        <Modal title="Remove the authenticator app" onClose={() => setDisabling(false)}>
          <p className="h-sub" style={{ marginBottom: 14 }}>Enter a current code from the app to confirm. Sign-in codes will go to your e-mail instead.</p>
          <OtpInput onComplete={async (code) => {
            try {
              setUser(await api<User>('/account/mfa/totp/disable', { body: { code } }));
              toast('Authenticator removed — e-mail codes are back on');
              setDisabling(false);
            } catch (err) {
              toast((err as Error).message, 'err');
            }
          }} />
        </Modal>
      )}
    </>
  );
}
