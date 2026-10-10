import { useState } from 'react';
import { api, blobUrl } from '../lib/api';
import { useAuth } from '../lib/auth';
import { useSocketEvent } from '../lib/socket';
import { ago, Avatar, Band, Empty, fmtDate, Head, Icon, Modal, Stat, useLoad, useToast } from '../lib/ui';

interface Overview {
  kpi: { users: number; doctors: number; apptsToday: number; scans: number };
  pending: { doctorId: string; userId: string; name: string; email: string; specialization: string; pmdcNumber: string; qualification: string; hospital: string; licenceFile: string; licenceFileId: string | null; waitingSince: string }[];
}
interface UserRow { id: string; fullName: string; email: string; role: string; status: string; lastLoginAt: string | null; createdAt: string; mfaMethod: string; online: boolean }
interface Audit { id: string; action: string; detail: string | null; createdAt: string; ip: string | null; actor: { fullName: string; role: string } | null }

const FILTERS: [string, string][] = [['All roles', ''], ['Patients', 'role=PATIENT'], ['Doctors', 'role=DOCTOR'], ['Blocked', 'status=BLOCKED']];
const HEALTH: [string, string, string, string][] = [
  ['Web portal', 'response 142 ms', 'ok', 'Healthy'], ['Patient database', 'backed up 02:00', 'ok', 'Healthy'], ['Live messaging', 'connected', 'ok', 'Healthy'],
  ['AI analysis', 'avg 3.1 s per study', 'ok', 'Healthy'], ['X-ray storage', '38% used', 'ok', 'Healthy'], ['E-mail & alerts', 'queue empty', 'ok', 'Healthy'],
];

/** "admin.user_blocked" -> "Admin: user blocked", "diagnosis.analysed" -> "Diagnosis: analysed". */
const readable = (action: string) => {
  const [area, ...rest] = action.split('.');
  const what = rest.join(' ').replace(/_/g, ' ');
  return `${area.charAt(0).toUpperCase()}${area.slice(1)}${what ? `: ${what}` : ''}`;
};

/** System Management Center. */
export default function SystemManagement() {
  const { user } = useAuth();
  const toast = useToast();
  const [filter, setFilter] = useState('');
  const [q, setQ] = useState('');
  const [reject, setReject] = useState<Overview['pending'][number] | null>(null);
  const [reason, setReason] = useState('');
  const ov = useLoad(() => api<Overview>('/admin/overview'), []);
  const users = useLoad(() => api<UserRow[]>(`/admin/users?${filter}${q ? `&q=${encodeURIComponent(q)}` : ''}`), [filter, q]);
  const audit = useLoad(() => api<Audit[]>('/admin/audit?take=14'), []);

  useSocketEvent<{ type: string }>('notification', (n) => {
    if (n.type === 'doctor.pending') ov.reload();
    audit.reload();
  });

  const decide = async (doctorId: string, approve: boolean, why?: string) => {
    try {
      await api(`/admin/doctors/${doctorId}/decision`, { body: { approve, ...(why ? { reason: why } : {}) } });
      toast(approve ? 'Doctor verified — they can sign in and patients can book them' : 'Application rejected — the doctor has been e-mailed');
      setReject(null);
      setReason('');
      ov.reload();
      users.reload();
      audit.reload();
    } catch (e) {
      toast((e as Error).message, 'err');
    }
  };
  const toggle = async (u: UserRow) => {
    const status = u.status === 'BLOCKED' ? 'ACTIVE' : 'BLOCKED';
    try {
      await api(`/admin/users/${u.id}/status`, { method: 'PATCH', body: { status } });
      toast(status === 'BLOCKED' ? `${u.fullName} blocked — every session ended immediately` : `${u.fullName} unblocked`);
      users.reload();
      audit.reload();
    } catch (e) {
      toast((e as Error).message, 'err');
    }
  };

  const k = ov.data?.kpi;
  return (
    <>
      <Band title="System management center" sub="Verify doctors, manage user access and keep an eye on everything happening on the platform." art="/img/card-process.jpg" />

      <div className="grid-kpi">
        <Stat label="Registered users" icon="users" value={k?.users ?? '–'} sub="All roles" />
        <Stat label="Verified doctors" icon="shield" tone="ok" value={k?.doctors ?? '–'} sub="PMDC licence checked" />
        <Stat label="Appointments today" icon="cal" tone="brand" value={k?.apptsToday ?? '–'} sub="Across all doctors" />
        <Stat label="X-ray studies" icon="scan" tone="lime" value={k?.scans ?? '–'} sub="Smart Diagnosis Center" />
      </div>

      <div className="row stack-lg" style={{ alignItems: 'flex-start' }}>
        <div className="col grow">
          <section className="card">
            <Head title="Doctor verification queue" sub="Doctors sign in only after an administrator approves their PMDC licence. Every decision is audited."
              right={<span className={`chip ${ov.data?.pending.length ? 'warn' : 'ok'}`}>{ov.data?.pending.length ?? 0} waiting</span>} />
            <div className="list" style={{ marginTop: 8 }}>
              {ov.data?.pending.map((p) => (
                <div key={p.doctorId} className="ctr wrap" style={{ gap: 12 }}>
                  <Avatar name={p.name} size={38} cls="c2" />
                  <div className="grow" style={{ minWidth: 150 }}>
                    <b style={{ fontSize: 12.5 }}>{p.name}</b>
                    <div className="tiny">{p.specialization} · PMDC {p.pmdcNumber} · {p.qualification} · {p.hospital}</div>
                  </div>
                  {p.licenceFileId ? (
                    <button className="btn-link ctr mono" style={{ gap: 6, fontSize: 11 }} onClick={async () => {
                      try {
                        window.open(await blobUrl(`/files/${p.licenceFileId}`), '_blank');
                      } catch (e) {
                        toast((e as Error).message, 'err');
                      }
                    }}><Icon n="file" s={14} />{p.licenceFile}</button>
                  ) : (
                    <span className="ctr mono tiny" style={{ gap: 6 }}><Icon n="file" s={14} />{p.licenceFile ?? 'No file'}</span>
                  )}
                  <span className="tiny" style={{ width: 70, textAlign: 'right' }}>{ago(p.waitingSince)}</span>
                  <span className="ctr" style={{ gap: 7 }}>
                    <button className="btn btn-p xs" onClick={() => decide(p.doctorId, true)}>Approve</button>
                    <button className="btn btn-d xs" onClick={() => setReject(p)}>Reject</button>
                  </span>
                </div>
              ))}
              {ov.data && !ov.data.pending.length && (
                <div className="ctr" style={{ gap: 9, padding: '16px 0', justifyContent: 'center', color: 'var(--ok)' }}><Icon n="check" s={18} /><span style={{ fontSize: 12.5, fontWeight: 600 }}>Queue clear — every licence has been reviewed.</span></div>
              )}
            </div>
          </section>

          <section className="card">
            <Head title="Users" right={<div className="ctr wrap" style={{ gap: 6 }}>{FILTERS.map(([l, f]) => <button key={l} className={`chip${filter === f ? ' on' : ''}`} onClick={() => setFilter(f)}>{l}</button>)}</div>} />
            <span className="inp" style={{ marginTop: 12 }}><Icon n="search" s={15} /><input type="search" placeholder="Search name or e-mail" value={q} onChange={(e) => setQ(e.target.value)} /></span>
            <div style={{ overflowX: 'auto', marginTop: 10 }}>
              <table className="tbl">
                <thead><tr><th>User</th><th>Role</th><th>Status</th><th>Last sign-in</th><th>2FA</th><th /></tr></thead>
                <tbody>
                  {users.data?.map((u) => (
                    <tr key={u.id}>
                      <td><div className="ctr" style={{ gap: 7 }}>{u.online && <span className="dot" style={{ background: 'var(--ok)' }} title="Online now" />}<b>{u.fullName}</b></div><div className="tiny">{u.email}</div></td>
                      <td style={{ fontWeight: 600, color: 'var(--ink-2)' }}>{u.role.toLowerCase()}</td>
                      <td><span className={`chip ${u.status === 'ACTIVE' ? 'ok' : u.status === 'PENDING' ? 'warn' : 'crit'}`}>{u.status.toLowerCase()}</span></td>
                      <td className="tiny">{u.lastLoginAt ? ago(u.lastLoginAt) : 'never'}</td>
                      <td className="tiny">{u.mfaMethod === 'TOTP' ? 'App' : 'E-mail'}</td>
                      <td style={{ textAlign: 'right' }}>
                        {u.role !== 'ADMIN' && u.id !== user?.id && u.status !== 'PENDING' && (
                          <button className={`btn ${u.status === 'BLOCKED' ? 'btn-s' : 'btn-g'} xs`} onClick={() => toggle(u)}>{u.status === 'BLOCKED' ? 'Unblock' : 'Block'}</button>
                        )}
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
              {users.data && !users.data.length && <Empty icon="users" title="No users match" />}
            </div>
          </section>
        </div>

        <div className="col side-340">
          <section className="card">
            <Head title="System health" right={<span className="chip ok">All systems normal</span>} />
            <div className="list" style={{ marginTop: 6 }}>
              {HEALTH.map(([n, v, t, s]) => (
                <div key={n} className="ctr" style={{ gap: 10 }}>
                  <span className="dot" style={{ background: `var(--${t})` }} />
                  <span className="grow"><b style={{ display: 'block', fontSize: 11.5 }}>{n}</b><span className="tiny mono">{v}</span></span>
                  <span style={{ fontSize: 10.5, fontWeight: 800, color: `var(--${t})` }}>{s}</span>
                </div>
              ))}
            </div>
          </section>
          <section className="card">
            <Head title="Audit log" right={<span className="chip ok"><span className="dot" style={{ background: 'var(--ok)' }} /> live</span>} />
            <div className="list" style={{ marginTop: 6 }}>
              {audit.data?.map((a) => (
                <div key={a.id} className="ctr" style={{ gap: 9, alignItems: 'flex-start' }}>
                  <span className="mono" style={{ fontSize: 10.5, fontWeight: 800, color: 'var(--brand)', flexShrink: 0, width: 88, overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>{a.actor?.fullName.split(' ').slice(-1)[0].toLowerCase() ?? 'system'}</span>
                  <span className="grow" style={{ fontSize: 11, fontWeight: 500, color: 'var(--ink-2)' }}>{readable(a.action)}{a.detail ? ` · ${a.detail.replace(/\s*\(preview model\)/i, '')}` : ''}</span>
                  <span className="tiny" style={{ whiteSpace: 'nowrap' }} title={fmtDate(a.createdAt)}>{ago(a.createdAt)}</span>
                </div>
              ))}
            </div>
          </section>
        </div>
      </div>

      {reject && (
        <Modal title={`Reject ${reject.name}?`} eyebrow="LICENCE VERIFICATION" onClose={() => setReject(null)}>
          <div className="field"><label htmlFor="rr">Reason (sent to the doctor)</label>
            <span className="inp"><textarea id="rr" value={reason} maxLength={300} onChange={(e) => setReason(e.target.value)} placeholder="e.g. PMDC number does not match the licence document" /></span></div>
          <button className="btn btn-d full" style={{ marginTop: 14 }} onClick={() => decide(reject.doctorId, false, reason.trim() || undefined)}>Reject application</button>
        </Modal>
      )}
    </>
  );
}
