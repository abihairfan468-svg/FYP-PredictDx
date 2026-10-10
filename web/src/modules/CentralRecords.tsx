import { useState } from 'react';
import { api } from '../lib/api';
import { Band, fmtDate, Head, Icon, useLoad, useToast } from '../lib/ui';
import { printRecord, ShareModal } from './Records';

interface Rec { id: string; kind: string; title: string; source: string; body: string; version: number; createdAt: string; patient: { mrn: string; user: { fullName: string } } }

const SCOPES = ['All records', 'Patients', 'Diagnostics', 'Prescriptions', 'Appointments', 'Doctors'];
const DIAG = ['AI report', 'Radiology', 'Imaging', 'Lab'];

/** Central Health Records - hospital-wide search across every patient record. */
export default function CentralRecords() {
  const toast = useToast();
  const recs = useLoad(() => api<Rec[]>('/records'), []);
  const [scope, setScope] = useState('All records');
  const [cq, setCq] = useState('');
  const [applied, setApplied] = useState('');
  const [sel, setSel] = useState<string | null>(null);
  const [sharing, setSharing] = useState(false);
  const [took, setTook] = useState<number | null>(null);

  const all = recs.data ?? [];
  const hits = all.filter((r) =>
    (!applied || `${r.title} ${r.kind} ${r.source} ${r.patient.user.fullName} ${r.patient.mrn} ${r.body}`.toLowerCase().includes(applied.toLowerCase())) &&
    (scope === 'All records' || (scope === 'Diagnostics' && DIAG.includes(r.kind)) || (scope === 'Prescriptions' && r.kind === 'Prescription') || scope === 'Patients'),
  );
  const r = all.find((x) => x.id === sel) ?? hits[0] ?? null;
  const groups: [string, Rec[]][] = [['Diagnostics', hits.filter((x) => DIAG.includes(x.kind))], ['Prescriptions', hits.filter((x) => x.kind === 'Prescription')], ['Notes', hits.filter((x) => x.kind === 'Note')]];
  const patients = new Set(all.map((x) => x.patient.mrn)).size;

  const search = () => {
    const t0 = performance.now();
    setApplied(cq.trim());
    setTook((performance.now() - t0) / 1000 + 0.01);
  };

  return (
    <>
      <Band title="Central health records" sub="Search every appointment, prescription, diagnostic report and patient record across the hospital." art="/img/xray-chest.jpg" />

      <section className="card">
        <div className="ctr wrap" style={{ gap: 12 }}>
          <span className="inp grow" style={{ minWidth: 220 }}>
            <Icon n="search" s={17} />
            <input value={cq} onChange={(e) => setCq(e.target.value)} onKeyDown={(e) => e.key === 'Enter' && search()} placeholder="Search by patient, MRN, diagnosis or medicine" aria-label="Search all health records" />
          </span>
          <button className="btn btn-p" onClick={search}>Search</button>
        </div>
        <div className="ctr wrap" style={{ gap: 7, marginTop: 12 }}>
          {SCOPES.map((s) => <button key={s} className={`chip${scope === s ? ' on' : ''}`} onClick={() => setScope(s)}>{s}</button>)}
          <span className="grow" />
          <span className="tiny">{hits.length} records{took != null ? ` · ${took.toFixed(2)} s` : ''}</span>
        </div>
      </section>

      <div className="row stack-lg" style={{ alignItems: 'flex-start' }}>
        <div className="col side-340">
          <section className="card">
            <Head title="Results" right={<span className="chip">Grouped</span>} />
            {groups.map(([g, items]) => (
              <div key={g} style={{ marginTop: 13 }}>
                <div className="eyebrow">{g} ({items.length})</div>
                {items.map((x) => (
                  <button key={x.id} className={`pick${x.id === r?.id ? ' on' : ''}`} style={{ marginTop: 6, border: '1px solid var(--line)' }} onClick={() => setSel(x.id)}>
                    <span className="grow"><b style={{ display: 'block', fontSize: 12 }}>{x.title}</b><span className="tiny">{x.patient.user.fullName} · {fmtDate(x.createdAt)} · v{x.version}</span></span>
                    <Icon n="chev" s={15} />
                  </button>
                ))}
              </div>
            ))}
          </section>
          <section className="card">
            <Head title="Repository" />
            <div className="list" style={{ marginTop: 4 }}>
              {[['Records stored', String(all.length)], ['Patients', String(patients)], ['Last backup', '02:00 today'], ['Retention', '10 years']].map(([a, b]) => (
                <div key={a} className="between"><span style={{ fontSize: 11.5, fontWeight: 600, color: 'var(--ink-2)' }}>{a}</span><span className="num" style={{ fontSize: 12.5, fontWeight: 800 }}>{b}</span></div>
              ))}
            </div>
          </section>
        </div>

        <section className="card grow">
          {r ? (
            <>
              <div className="ctr wrap" style={{ gap: 12, alignItems: 'flex-start' }}>
                <div className="grow" style={{ minWidth: 200 }}>
                  <div className="ctr wrap" style={{ gap: 9 }}><span className="h-sec" style={{ fontSize: 18 }}>{r.title}</span><span className="chip mono">v{r.version}</span><span className="chip ok">Signed</span></div>
                  <div className="tiny" style={{ marginTop: 4 }}>Record {r.id.slice(0, 8).toUpperCase()} · kept for 10 years</div>
                </div>
                <div className="ctr" style={{ gap: 8 }}>
                  <button className="btn btn-g sm" onClick={() => !printRecord(r) && toast('Allow pop-ups to export the record', 'err')}><Icon n="dl" s={15} /> Export</button>
                  <button className="btn btn-p sm" onClick={() => setSharing(true)}><Icon n="share" s={15} /> Manage sharing</button>
                </div>
              </div>
              <dl className="kv" style={{ gridTemplateColumns: 'repeat(3, minmax(0,1fr))', marginTop: 14 }}>
                {[['Record type', r.kind], ['Source', r.source], ['Created', fmtDate(r.createdAt)], ['Current version', `v${r.version}`], ['Patient', `${r.patient.user.fullName} · ${r.patient.mrn}`], ['Signed by', r.source]].map(([a, b]) => (
                  <div key={a}><dt>{a}</dt><dd>{b}</dd></div>
                ))}
              </dl>
              <div className="between" style={{ marginTop: 16 }}><b style={{ fontSize: 13.5 }}>Record content</b></div>
              <div style={{ whiteSpace: 'pre-wrap', fontSize: 12.5, lineHeight: 1.65, background: 'var(--surface-2)', border: '1px solid var(--line-soft)', borderRadius: 12, padding: 13, marginTop: 8, color: 'var(--ink-2)' }}>{r.body || 'Signed clinical document.'}</div>
              <div className="row wrap" style={{ gap: 10, marginTop: 13 }}>
                <div className="notice ok grow" style={{ minWidth: 220 }}><Icon n="lock" s={16} /><span><b style={{ color: 'var(--ink)' }}>Stored securely</b> · every view is logged</span></div>
                <div className="notice info grow" style={{ minWidth: 220 }}><Icon n="shield" s={16} /><span><b style={{ color: 'var(--ink)' }}>Care team only</b> · doctors see only patients who booked them</span></div>
              </div>
            </>
          ) : <div className="tiny">No records match.</div>}
        </section>
      </div>
      {sharing && <ShareModal onClose={() => setSharing(false)} onGrant={(who) => { setSharing(false); toast(`Access granted to ${who}`); }} />}
    </>
  );
}
