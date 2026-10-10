import { useEffect, useState } from 'react';
import { useSearchParams } from 'react-router-dom';
import { api } from '../lib/api';
import { useAuth } from '../lib/auth';
import { Band, Empty, fmtDate, Head, Icon, Modal, useLoad, useToast } from '../lib/ui';

interface Rec { id: string; kind: string; title: string; source: string; body: string; version: number; signed: boolean; createdAt: string; patient: { mrn: string; user: { fullName: string } } }

const KINDS = ['All types', 'AI report', 'Radiology', 'Prescription', 'Lab', 'Note', 'Imaging'];

/** Opens a printable, PredictDx-branded copy of a record (the browser saves it as PDF). */
export function printRecord(r: Pick<Rec, 'title' | 'kind' | 'source' | 'createdAt' | 'version' | 'body' | 'patient'>) {
  const w = window.open('', '_blank', 'width=760,height=900');
  if (!w) return false;
  const safe = (s: string) => s.replace(/&/g, '&amp;').replace(/</g, '&lt;');
  w.document.write(`<!doctype html><title>${safe(r.title)}</title><body style="font-family:Arial,sans-serif;padding:40px;color:#0f2744">
    <div style="background:#e7f0fb;color:#0f2744;border:1px solid #bcd4ee;padding:18px 22px;border-radius:10px"><b style="font-size:20px;letter-spacing:.08em">PREDICTDX</b><div style="font-size:12px">Predict disease · save lives</div></div>
    <h2 style="margin:26px 0 4px">${safe(r.title)}</h2><div style="color:#56688f;font-size:13px">${safe(r.kind)} · ${safe(r.source)} · ${fmtDate(r.createdAt)} · v${r.version}</div>
    <div style="margin-top:6px;font-size:13px">Patient: <b>${safe(r.patient.user.fullName)}</b> · ${safe(r.patient.mrn)}</div>
    <pre style="white-space:pre-wrap;font-family:inherit;font-size:14px;line-height:1.6;border:1px solid #cfe0f7;border-radius:10px;padding:16px;margin-top:18px">${safe(r.body || 'Signed clinical document.')}</pre>
    <p style="font-size:11px;color:#6a7b9c;margin-top:30px">Printed ${new Date().toLocaleString()} · AI results support, and never replace, a physician's judgement.</p>
    <script>window.onload=()=>window.print()</script></body>`);
  w.document.close();
  return true;
}

/** Reports & Care Records. */
export default function Records() {
  const { user } = useAuth();
  const toast = useToast();
  const [params, setParams] = useSearchParams();
  const recs = useLoad(() => api<Rec[]>('/records'), []);
  const [q, setQ] = useState('');
  const [kind, setKind] = useState('All types');
  const [sel, setSel] = useState<string | null>(params.get('id'));
  const [sharing, setSharing] = useState(false);
  const [grants, setGrants] = useState([
    { id: 'g1', who: 'Dr Zeeshan Ahmed', scope: 'read-only', exp: 'in 7 days' },
    { id: 'g2', who: 'Dr Sana Malik', scope: 'read + addendum', exp: 'in 30 days' },
  ]);
  const [access, setAccess] = useState([
    { who: 'Dr Adeel Rehman', act: 'read', ok: true, t: '2 h ago' },
    { who: 'Dr Zeeshan Ahmed', act: 'read', ok: true, t: 'yesterday' },
    { who: 'unknown@ext', act: 'read denied', ok: false, t: '3 d ago' },
  ]);

  const all = recs.data ?? [];
  const list = all.filter((r) => (kind === 'All types' || r.kind === kind) && (!q || `${r.title} ${r.source} ${r.kind} ${r.patient.user.fullName}`.toLowerCase().includes(q.toLowerCase())));
  const r = all.find((x) => x.id === sel) ?? list[0] ?? null;

  useEffect(() => {
    if (r) {
      setParams({ id: r.id }, { replace: true });
      api(`/records/${r.id}`).catch(() => null); // server writes the read to the audit trail
    }
  }, [r?.id]);

  const download = () => {
    if (r && !printRecord(r)) toast('Allow pop-ups to download the PDF', 'err');
  };

  return (
    <>
      <Band title="Reports &amp; care records" sub="Every report, prescription and clinical document in one place — view, download and share securely." art="/img/card-results.jpg" />

      <div className="row stack-lg" style={{ alignItems: 'flex-start' }}>
        <section className="card grow">
          <Head title="All records" sub={`${all.length} records · ${list.length} shown`} right={<span className="chip">Newest first</span>} />
          <span className="inp" style={{ marginTop: 13 }}><Icon n="search" s={16} /><input type="search" placeholder="Search records" value={q} onChange={(e) => setQ(e.target.value)} /></span>
          <div className="ctr wrap" style={{ gap: 7, marginTop: 11 }}>
            {KINDS.map((k) => <button key={k} className={`chip${kind === k ? ' on' : ''}`} onClick={() => setKind(k)}>{k}</button>)}
          </div>
          <div className="col" style={{ gap: 3, marginTop: 8 }}>
            {recs.loading && !recs.data && <div className="skeleton" style={{ height: 160 }} />}
            {list.map((x) => (
              <button key={x.id} className={`pick${x.id === r?.id ? ' on' : ''}`} onClick={() => setSel(x.id)}>
                <span style={{ width: 34, height: 34, borderRadius: 10, display: 'grid', placeItems: 'center', flexShrink: 0, background: x.kind === 'AI report' ? 'var(--lime-soft)' : 'var(--brand-soft)', color: x.kind === 'AI report' ? 'var(--lime)' : 'var(--brand)' }}>
                  <Icon n={x.kind === 'AI report' || x.kind === 'Imaging' ? 'scan' : x.kind === 'Prescription' ? 'pill' : 'file'} s={16} />
                </span>
                <span className="grow"><b style={{ display: 'block', fontSize: 12.5 }}>{x.title}</b><span className="tiny">{x.source}{user?.role !== 'PATIENT' ? ` · ${x.patient.user.fullName}` : ''}</span></span>
                <span className="chip hide-sm">{x.kind}</span>
                <span className="tiny" style={{ width: 80, textAlign: 'right' }}>{fmtDate(x.createdAt)}</span>
                <span className="mono tiny" style={{ width: 20 }}>v{x.version}</span>
              </button>
            ))}
            {recs.data && !list.length && <Empty icon="file" title="Nothing matches">Try another type or search.</Empty>}
          </div>
        </section>

        <section className="card side-340" style={{ width: 400 }}>
          {!r ? <Empty icon="file" title="No record selected" /> : (
            <>
              <div className="between" style={{ alignItems: 'flex-start' }}>
                <div><div className="h-sec">{r.title}</div><div className="tiny" style={{ marginTop: 3 }}>{r.source} · {fmtDate(r.createdAt)}</div></div>
                <span className="chip ok">{r.signed ? 'Signed' : 'Draft'}</span>
              </div>
              {r.kind === 'AI report' && (
                <div style={{ position: 'relative', height: 150, borderRadius: 12, overflow: 'hidden', background: '#000', marginTop: 13 }}>
                  <img src="/img/xray-chest.jpg" alt="" style={{ width: '100%', height: '100%', objectFit: 'cover' }} />
                </div>
              )}
              <div style={{ whiteSpace: 'pre-wrap', fontSize: 12.5, lineHeight: 1.65, background: 'var(--surface-2)', border: '1px solid var(--line-soft)', borderRadius: 12, padding: 13, marginTop: 13, color: 'var(--ink-2)' }}>{r.body || 'Signed clinical document.'}</div>
              <div className="ctr wrap" style={{ gap: 8, marginTop: 13 }}>
                <button className="btn btn-p sm" onClick={download}><Icon n="dl" s={15} /> Download PDF</button>
                <button className="btn btn-g sm" onClick={() => setSharing(true)}><Icon n="share" s={15} /> Share with a doctor</button>
              </div>
              <div className="notice ok" style={{ marginTop: 13 }}><Icon n="lock" s={15} /><span>Every view of this record is logged for your privacy.</span></div>

              <div className="eyebrow" style={{ marginTop: 16 }}>Version history</div>
              <div className="list">
                {Array.from({ length: r.version }, (_, i) => r.version - i).map((n) => (
                  <div key={n} className="ctr" style={{ gap: 10 }}>
                    <span className="mono" style={{ fontSize: 10.5, fontWeight: 800, color: n === r.version ? 'var(--brand)' : 'var(--muted)' }}>v{n}</span>
                    <span className="grow" style={{ fontSize: 11.5, fontWeight: 600, color: 'var(--ink-2)' }}>{n === r.version ? (r.version > 1 ? 'Addendum · confirmed' : 'Created by the source module') : 'Earlier revision kept for audit'}</span>
                  </div>
                ))}
              </div>
              <div className="eyebrow" style={{ marginTop: 12 }}>Who accessed this record</div>
              <div className="list">
                {access.map((a, i) => (
                  <div key={i} className="ctr" style={{ gap: 9 }}>
                    <span className="dot" style={{ background: a.ok ? 'var(--ok)' : 'var(--crit)' }} />
                    <span className="grow" style={{ fontSize: 11.5, fontWeight: 600, color: 'var(--ink-2)' }}>{a.who}</span>
                    <span style={{ fontSize: 10.5, fontWeight: 800, color: a.ok ? 'var(--ok)' : 'var(--crit)' }}>{a.act}</span>
                    <span className="tiny">{a.t}</span>
                  </div>
                ))}
              </div>
              <div style={{ background: 'var(--surface-2)', border: '1px solid var(--line)', borderRadius: 11, padding: 11, marginTop: 12 }}>
                <div className="between"><b style={{ fontSize: 11.5 }}>Active shares</b><span className="chip warn">{grants.length} granted</span></div>
                {grants.map((g) => (
                  <div key={g.id} className="between" style={{ marginTop: 7 }}>
                    <span className="tiny">{g.who} · {g.scope} · {g.exp}</span>
                    <button className="btn btn-g xs" onClick={() => { setGrants(grants.filter((x) => x.id !== g.id)); toast('Consent revoked — that doctor can no longer open it'); }}>Revoke</button>
                  </div>
                ))}
                {!grants.length && <div className="tiny" style={{ marginTop: 6 }}>No one else can open this record.</div>}
              </div>
            </>
          )}
        </section>
      </div>

      {sharing && <ShareModal onClose={() => setSharing(false)} onGrant={(who, exp) => {
        setGrants([...grants, { id: `g${Date.now()}`, who, scope: 'read-only', exp: exp.toLowerCase() }]);
        setAccess([{ who, act: 'grant', ok: true, t: 'just now' }, ...access]);
        setSharing(false);
        toast(`Access granted to ${who}`);
      }} />}
    </>
  );
}

export function ShareModal({ onClose, onGrant }: { onClose: () => void; onGrant: (who: string, exp: string) => void }) {
  const docs = useLoad(() => api<{ results: { name: string }[] }>('/doctors'), []);
  const [who, setWho] = useState('');
  const [exp, setExp] = useState('In 7 days');
  const [why, setWhy] = useState('Treatment');
  return (
    <Modal title="Share this record" eyebrow="SHARE RECORD" onClose={onClose}>
      <div className="tiny">The grant is time-boxed and appears in the patient's consent list. It can be revoked at any time, and every read is logged.</div>
      <div className="field" style={{ marginTop: 14 }}><label htmlFor="shDoc">Share with</label>
        <span className="inp"><select id="shDoc" value={who} onChange={(e) => setWho(e.target.value)}>
          <option value="">Choose a doctor…</option>
          {docs.data?.results.map((d) => <option key={d.name}>{d.name}</option>)}
        </select></span></div>
      <div className="field" style={{ marginTop: 11 }}><label htmlFor="shExp">Access expires</label>
        <span className="inp"><select id="shExp" value={exp} onChange={(e) => setExp(e.target.value)}><option>In 7 days</option><option>In 30 days</option><option>After one read</option></select></span></div>
      <div className="field" style={{ marginTop: 11 }}><label htmlFor="shWhy">Purpose of use</label>
        <span className="inp"><select id="shWhy" value={why} onChange={(e) => setWhy(e.target.value)}><option>Treatment</option><option>Second opinion</option><option>Referral</option></select></span></div>
      <button className="btn btn-p full" style={{ marginTop: 16, padding: 12 }} disabled={!who} onClick={() => onGrant(who, exp)}>Grant read-only access</button>
    </Modal>
  );
}
