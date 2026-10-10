import { useEffect, useRef, useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { api } from '../lib/api';
import { useSocketEvent } from '../lib/socket';
import { Avatar, Band, bandTone, Empty, fmtDate, fmtTime, Head, Icon, Modal, Stat, useLoad, useToast } from '../lib/ui';

interface RxItem { name: string; dose: string; frequency: string }
interface Visit {
  id: string; startAt: string; status: string; reason: string | null; paid: boolean;
  patient: { id: string; userId: string; name: string; mrn: string; gender: string | null; age: number | null; city: string | null; flags: string[] };
  consultation: { vitals: Record<string, string>; notes: string; testOrder: string | null; followUpAt: string | null; aiDisagree: boolean } | null;
  prescription: { id: string; code: string; status: string; items: RxItem[]; signedAt: string | null } | null;
}
interface Day {
  doctor: { name: string; specialization: string; pmdcNumber: string; room: string };
  stats: { total: number; done: number; remaining: number; draftPrescriptions: number; upcomingConfirmed: number; aiResults: number };
  appointments: Visit[];
}
interface Detail extends Visit {
  history: { id: string; startAt: string; notes: string }[];
  records: { id: string; title: string; kind: string; createdAt: string; source: string }[];
  aiInsight: { code: string; createdAt: string; modelVersion: string; result: { label: string; confidence: number; probabilities: Record<string, number>; risk: { score: number; band: string; followUp?: string }; assessment?: { band: string; text: string } } } | null;
}
interface Warning { severity: 'major' | 'moderate' | 'minor'; message: string }

const STATUS: Record<string, [string, string]> = { CONFIRMED: ['Booked', ''], CHECKED_IN: ['Checked in', 'ok'], IN_CONSULTATION: ['Now', 'on'], COMPLETED: ['Done', 'ai'] };
const NEXT_ACTION: Record<string, [string, string] | undefined> = {
  CONFIRMED: ['CHECKED_IN', 'Check in'],
  CHECKED_IN: ['IN_CONSULTATION', 'Call patient in'],
  IN_CONSULTATION: ['COMPLETED', 'Complete visit'],
};
const iso = (d: Date) => `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}-${String(d.getDate()).padStart(2, '0')}`;
const toLocalInput = (d: string | null) => {
  if (!d) return '';
  const x = new Date(d);
  return `${iso(x)}T${String(x.getHours()).padStart(2, '0')}:${String(x.getMinutes()).padStart(2, '0')}`;
};

export default function Workspace() {
  const toast = useToast();
  const nav = useNavigate();
  const [date, setDate] = useState(iso(new Date()));
  const [active, setActive] = useState<string | null>(null);
  const day = useLoad(() => api<Day>(`/workspace/day?date=${date}`), [date]);
  const detail = useLoad(() => (active ? api<Detail>(`/workspace/appointments/${active}`) : Promise.resolve(null)), [active]);

  useEffect(() => {
    const list = day.data?.appointments ?? [];
    if (!list.length) setActive(null);
    else if (!active || !list.some((a) => a.id === active)) setActive((list.find((a) => a.status !== 'COMPLETED') ?? list[0]).id);
  }, [day.data]);

  useSocketEvent('appointment:update', () => day.reload());

  const d = detail.data;
  const setStatus = async (status: string) => {
    if (!d) return;
    try {
      await api(`/workspace/appointments/${d.id}/status`, { method: 'PATCH', body: { status } });
      toast(status === 'IN_CONSULTATION' ? `${d.patient.name} has been called in — they got a notification` : status === 'COMPLETED' ? 'Visit completed' : 'Patient checked in');
      day.reload();
      detail.reload();
    } catch (e) {
      toast((e as Error).message, 'err');
    }
  };

  const message = async () => {
    if (!d) return;
    const t = await api<{ id: string }>('/chat/threads', { body: { userId: d.patient.userId } });
    nav(`/app/careconnect?thread=${t.id}`);
  };

  const st = day.data?.stats;
  const shift = (n: number) => {
    const x = new Date(`${date}T00:00:00`);
    x.setDate(x.getDate() + n);
    setDate(iso(x));
  };

  return (
    <>
      <Band title="Doctor workspace" sub={day.data ? `${day.data.doctor.name} · ${day.data.doctor.specialization} · PMDC ${day.data.doctor.pmdcNumber} · ${day.data.doctor.room}` : 'Consultations, AI insight and digital prescriptions'} art="/img/card-results.jpg" />

      <div className="grid-kpi">
        <Stat label="Appointments this day" icon="cal" value={st?.total ?? '–'} sub={st ? `${st.done} done · ${st.remaining} remaining` : ''} />
        <Stat label="AI results available" icon="scan" tone="brand" value={st?.aiResults ?? '–'} sub="From the Diagnosis Center" />
        <Stat label="Prescriptions in draft" icon="pill" tone="warn" value={st?.draftPrescriptions ?? '–'} sub="Sign to send to the patient" />
        <Stat label="Upcoming bookings" icon="clock" tone="ok" value={st?.upcomingConfirmed ?? '–'} sub="Confirmed and paid" />
      </div>

      <div className="row stack-lg" style={{ alignItems: 'flex-start' }}>
        {/* ------------------------------------------------ queue */}
        <section className="card side-240">
          <Head title={new Date(`${date}T00:00:00`).toLocaleDateString('en-GB', { weekday: 'short', day: '2-digit', month: 'short' })} sub={`${st?.total ?? 0} appointments`} />
          <div className="ctr" style={{ gap: 6, marginTop: 10 }}>
            <button className="ibtn sm" onClick={() => shift(-1)} aria-label="Previous day"><Icon n="back" s={14} /></button>
            <span className="inp grow" style={{ padding: '0 8px' }}><input type="date" value={date} onChange={(e) => e.target.value && setDate(e.target.value)} aria-label="Queue date" style={{ padding: '6px 0', fontSize: 12 }} /></span>
            <button className="ibtn sm" onClick={() => shift(1)} aria-label="Next day"><Icon n="chev" s={14} /></button>
          </div>
          <div className="col" style={{ gap: 2, marginTop: 10 }}>
            {day.data?.appointments.map((x) => (
              <button key={x.id} className={`pick${x.id === active ? ' on' : ''}`} onClick={() => setActive(x.id)}>
                <b className="num" style={{ width: 52, fontSize: 11, color: x.id === active ? 'var(--brand)' : 'var(--muted)' }}>{fmtTime(x.startAt)}</b>
                <span className="grow">
                  <b style={{ display: 'block', fontSize: 12.5 }}>{x.patient.name}</b>
                  <span className="tiny">{x.patient.age ?? '–'} {x.patient.gender?.[0] ?? ''} · {x.reason ?? 'Consultation'}</span>
                </span>
                <span className={`chip ${STATUS[x.status]?.[1]}`} style={{ fontSize: 9.5, padding: '3px 7px' }}>{STATUS[x.status]?.[0]}</span>
              </button>
            ))}
            {day.data && !day.data.appointments.length && <Empty icon="cal" title="No appointments">Paid bookings appear here in real time.</Empty>}
          </div>
        </section>

        {/* ------------------------------------------------ consultation */}
        <section className="card grow">
          {!d ? (
            detail.loading && active ? <div className="skeleton" style={{ height: 300 }} /> : <Empty icon="stet" title="Pick a patient">Select an appointment from the queue.</Empty>
          ) : (
            <Consultation key={d.id} d={d} onStatus={setStatus} onMessage={message} onChanged={() => day.reload()} />
          )}
        </section>

        {/* ------------------------------------------------ prescription */}
        <section className="card side-300">
          {d ? <Prescription key={d.id} d={d} onSigned={() => { day.reload(); detail.reload(); }} /> : <Empty icon="pill" title="Digital prescription">Open a patient to prescribe.</Empty>}
        </section>
      </div>
    </>
  );
}

/* ------------------------------------------------------------------ consultation panel */
function Consultation({ d, onStatus, onMessage, onChanged }: { d: Detail; onStatus: (s: string) => void; onMessage: () => void; onChanged: () => void }) {
  const toast = useToast();
  const nav = useNavigate();
  const [tab, setTab] = useState<'AI insight' | 'Notes' | 'History'>('AI insight');
  const [vitals, setVitals] = useState<Record<string, string>>(d.consultation?.vitals ?? {});
  const [notes, setNotes] = useState(d.consultation?.notes ?? '');
  const [saved, setSaved] = useState<string | null>(null);
  const [saving, setSaving] = useState(false);
  const lastSaved = useRef(JSON.stringify({ vitals, notes }));

  // Autosave 700 ms after the doctor stops typing (only when something actually changed).
  useEffect(() => {
    const snapshot = JSON.stringify({ vitals, notes });
    if (snapshot === lastSaved.current) return;
    lastSaved.current = snapshot;
    setSaving(true);
    const t = setTimeout(async () => {
      try {
        const r = await api<{ savedAt: string }>(`/workspace/appointments/${d.id}/consultation`, { method: 'PUT', body: { vitals, notes } });
        setSaved(fmtTime(r.savedAt));
      } catch (e) {
        toast((e as Error).message, 'err');
      } finally {
        setSaving(false);
      }
    }, 700);
    return () => clearTimeout(t);
  }, [vitals, notes]);

  const ai = d.aiInsight?.result;
  const tone = ai ? (ai.label === 'Normal' ? 'ok' : ai.confidence >= 70 ? 'crit' : 'warn') : 'ok';
  const next = NEXT_ACTION[d.status];
  const warnV = (k: string, v: string) => (k === 'spo2' && parseInt(v) < 95) || (k === 'temp' && parseFloat(v) > 37.5);

  return (
    <>
      <div className="ctr wrap" style={{ gap: 12 }}>
        <Avatar name={d.patient.name} size={46} />
        <div className="grow" style={{ minWidth: 150 }}>
          <div className="ctr" style={{ gap: 8 }}>
            <span style={{ fontSize: 17, fontWeight: 800, fontFamily: 'var(--font-d)' }}>{d.patient.name}</span>
            <span className="chip mono" style={{ fontSize: 10 }}>{d.patient.mrn}</span>
          </div>
          <div className="tiny">{d.patient.age ?? '–'} yrs · {d.patient.gender?.toLowerCase() ?? '–'} · {d.reason ?? 'Consultation'} · {fmtTime(d.startAt)}</div>
        </div>
        <div className="ctr wrap" style={{ gap: 6 }}>
          {d.patient.flags.map((f) => <span key={f} className={`chip ${/TB|allergy/i.test(f) ? 'crit' : /smok|diab/i.test(f) ? 'warn' : 'ok'}`}>{f}</span>)}
        </div>
      </div>

      <div className="ctr wrap" style={{ gap: 8, marginTop: 14 }}>
        {next && <button className="btn btn-p sm" onClick={() => onStatus(next[0])}><Icon n={next[0] === 'COMPLETED' ? 'check' : 'stet'} s={14} /> {next[1]}</button>}
        {d.status === 'COMPLETED' && <span className="chip ai"><Icon n="check" s={12} /> Visit completed</span>}
        <button className="btn btn-g sm" onClick={onMessage}><Icon n="chat" s={14} /> Message patient</button>
        <span className="grow" />
        <span className="chip" aria-live="polite">{saving ? 'Saving…' : saved ? `Auto-saved ${saved}` : 'Auto-save on'}</span>
      </div>

      <div className="vitals" style={{ marginTop: 14 }}>
        {([['bp', 'Blood pressure'], ['spo2', 'SpO₂'], ['temp', 'Temperature'], ['weight', 'Weight']] as const).map(([k, l]) => (
          <label key={k}>
            <span className="eyebrow">{l}</span>
            <input value={vitals[k] ?? ''} placeholder="–" onChange={(e) => setVitals({ ...vitals, [k]: e.target.value })} style={{ color: warnV(k, vitals[k] ?? '') ? 'var(--warn)' : undefined }} />
          </label>
        ))}
      </div>

      <div className="between" style={{ marginTop: 16 }}>
        <div className="tabs">{(['AI insight', 'Notes', 'History'] as const).map((t) => <button key={t} className={tab === t ? 'on' : ''} onClick={() => setTab(t)}>{t}</button>)}</div>
        <span className="tiny">{d.paid ? 'Fee paid' : 'Unpaid'}</span>
      </div>
      <div style={{ height: 13 }} />

      {tab === 'AI insight' && (
        <div style={{ border: '1px solid var(--line)', borderRadius: 16, overflow: 'hidden' }}>
          <div className="ctr" style={{ gap: 9, padding: '11px 14px', background: 'var(--surface-2)', borderBottom: '1px solid var(--line)' }}>
            <span style={{ color: 'var(--brand)' }}><Icon n="scan" s={17} /></span>
            <b style={{ fontSize: 13 }}>AI diagnostic insight</b>
            <span className="grow" />
            <span className="aitag">AI ASSIST</span>
          </div>
          {ai ? (
            <div className="ctr wrap" style={{ gap: 14, padding: 14, alignItems: 'flex-start' }}>
              <div style={{ position: 'relative', width: 150, height: 150, borderRadius: 12, overflow: 'hidden', background: '#000', flexShrink: 0 }}>
                <img src="/img/xray-chest.jpg" alt="" style={{ width: '100%', height: '100%', objectFit: 'cover' }} />
              </div>
              <div className="grow" style={{ minWidth: 190 }}>
                <div className="ctr" style={{ gap: 8 }}>
                  <span style={{ fontFamily: 'var(--font-d)', fontSize: 22, fontWeight: 800 }}>{ai.label}</span>
                  <span className={`chip ${bandTone(ai.risk.band)}`}>{ai.risk.band} risk</span>
                </div>
                <div className="between" style={{ fontSize: 11.5, fontWeight: 600, color: 'var(--ink-2)', marginTop: 9 }}><span>Model confidence</span><span className="num" style={{ color: 'var(--ink)', fontWeight: 800 }}>{ai.confidence}%</span></div>
                <div className="meter" style={{ marginTop: 5 }}><i style={{ width: `${ai.confidence}%`, background: `var(--${tone})` }} /></div>
                <div className="ctr wrap" style={{ gap: 6, marginTop: 11 }}>
                  {Object.entries(ai.probabilities).map(([k, v]) => <span key={k} className="chip">{k} {v}%</span>)}
                </div>
                {ai.assessment && <div style={{ fontSize: 12, marginTop: 9 }}>{ai.assessment.text}</div>}
                {ai.risk.followUp && <div style={{ fontSize: 12, marginTop: 5 }}><b>Follow-up:</b> {ai.risk.followUp}</div>}
                <div className="tiny" style={{ marginTop: 9 }}>{d.aiInsight!.code} · {fmtDate(d.aiInsight!.createdAt)} · AI assisted</div>
                <div className="ctr wrap" style={{ gap: 8, marginTop: 11 }}>
                  <button className="btn btn-p sm" onClick={() => nav('/app/diagnosis')}>Open in Diagnosis Center</button>
                  <button className="btn btn-g sm" disabled={d.consultation?.aiDisagree} onClick={async () => {
                    await api(`/workspace/appointments/${d.id}/ai-disagree`, { body: {} });
                    toast('Your disagreement has been recorded for review');
                    onChanged();
                  }}>{d.consultation?.aiDisagree ? 'Disagreement logged' : 'Disagree with AI'}</button>
                </div>
              </div>
            </div>
          ) : (
            <div style={{ padding: 18 }} className="ctr wrap">
              <span className="grow tiny">No analysed X-ray for this patient yet. Upload one in the Diagnosis Center and the result appears here.</span>
              <button className="btn btn-s sm" onClick={() => nav('/app/diagnosis')}>Open Diagnosis Center</button>
            </div>
          )}
        </div>
      )}

      {tab === 'Notes' && (
        <div style={{ border: '1px solid var(--line)', borderRadius: 14, padding: 13 }}>
          <div className="between"><b style={{ fontSize: 12.5 }}>Consultation note</b><span className="chip">{notes.length}/5000</span></div>
          <label className="sr" htmlFor="cnote">Consultation note</label>
          <textarea id="cnote" rows={7} maxLength={5000} value={notes} onChange={(e) => setNotes(e.target.value)} placeholder="History, examination, impression, plan…"
            style={{ width: '100%', border: 0, background: 'transparent', outline: 0, resize: 'vertical', fontSize: 13, lineHeight: 1.6, color: 'var(--ink-2)', marginTop: 7 }} />
          <div className="tiny">Signed together with the prescription as a “Consultation summary” record.</div>
        </div>
      )}

      {tab === 'History' && (
        <div className="list">
          {d.history.map((h) => (
            <div key={h.id}><b style={{ fontSize: 12.5 }}>Visit · {fmtDate(h.startAt)}</b><div className="tiny" style={{ marginTop: 3 }}>{h.notes || 'No note recorded.'}</div></div>
          ))}
          {d.records.map((r) => (
            <div key={r.id} className="between"><span><b style={{ fontSize: 12.5 }}>{r.title}</b><div className="tiny">{r.source} · {fmtDate(r.createdAt)}</div></span><span className="chip">{r.kind}</span></div>
          ))}
          {!d.history.length && !d.records.length && <Empty icon="clock" title="First visit">No earlier visits or records.</Empty>}
        </div>
      )}
    </>
  );
}

/* ------------------------------------------------------------------ prescription panel */
function Prescription({ d, onSigned }: { d: Detail; onSigned: () => void }) {
  const toast = useToast();
  const [items, setItems] = useState<RxItem[]>(d.prescription?.items ?? []);
  const [warnings, setWarnings] = useState<Warning[]>([]);
  const [signed, setSigned] = useState(d.prescription?.status === 'SIGNED');
  const [code, setCode] = useState(d.prescription?.code ?? null);
  const [adding, setAdding] = useState(false);
  const [testOrder, setTestOrder] = useState(d.consultation?.testOrder ?? '');
  const [followUp, setFollowUp] = useState(toLocalInput(d.consultation?.followUpAt ?? null));
  const [busy, setBusy] = useState(false);
  const lastSaved = useRef(JSON.stringify({ testOrder, followUp }));

  const saveItems = async (next: RxItem[]) => {
    setItems(next);
    try {
      const r = await api<{ code: string; warnings: Warning[] }>(`/workspace/appointments/${d.id}/prescription`, { method: 'PUT', body: { items: next } });
      setWarnings(r.warnings);
      setCode(r.code);
    } catch (e) {
      toast((e as Error).message, 'err');
    }
  };
  useEffect(() => {
    if (items.length && !signed) saveItems(items);
  }, []);

  // Test order + follow-up autosave.
  useEffect(() => {
    const snapshot = JSON.stringify({ testOrder, followUp });
    if (snapshot === lastSaved.current) return;
    lastSaved.current = snapshot;
    const t = setTimeout(() => {
      api(`/workspace/appointments/${d.id}/consultation`, { method: 'PUT', body: { testOrder, followUpAt: followUp ? new Date(followUp).toISOString() : null } }).catch((e) => toast(e.message, 'err'));
    }, 600);
    return () => clearTimeout(t);
  }, [testOrder, followUp]);

  const sign = async () => {
    setBusy(true);
    try {
      const r = await api<{ code: string }>(`/workspace/appointments/${d.id}/prescription/sign`, { body: {} });
      setSigned(true);
      toast(`${r.code} signed — sent to ${d.patient.name} and filed in Reports & Care Records`);
      onSigned();
    } catch (e) {
      toast((e as Error).message, 'err');
    } finally {
      setBusy(false);
    }
  };

  const major = warnings.some((w) => w.severity === 'major');
  return (
    <>
      <Head title="Digital prescription" sub={code ?? 'New'} right={<span className={`chip ${signed ? 'ok' : 'warn'}`}>{signed ? 'Signed' : 'Draft'}</span>} />
      <div className="col" style={{ gap: 8, marginTop: 12 }}>
        {items.map((m, i) => (
          <div key={`${m.name}-${i}`} style={{ border: '1px solid var(--line)', borderRadius: 11, padding: '10px 11px' }}>
            <div className="between">
              <b style={{ fontSize: 12.5 }}>{m.name}</b>
              <span className="ctr" style={{ gap: 6 }}>
                <span className="chip on">{m.dose}</span>
                {!signed && <button className="ibtn sm" aria-label={`Remove ${m.name}`} onClick={() => saveItems(items.filter((_, j) => j !== i))}><Icon n="x" s={13} /></button>}
              </span>
            </div>
            <div className="tiny" style={{ marginTop: 4 }}>{m.frequency}</div>
          </div>
        ))}
        {!items.length && <div className="tiny" style={{ padding: '12px 0', textAlign: 'center' }}>No medicines on this prescription yet.</div>}
      </div>
      {!signed && <button className="btn btn-s full sm" style={{ marginTop: 9 }} onClick={() => setAdding(true)}><Icon n="plus" s={15} /> Add medicine</button>}

      <div className="col" style={{ gap: 6, marginTop: 12 }}>
        {items.length > 0 && !warnings.length && (
          <div className="notice ok"><Icon n="check" s={15} /><span>Interaction check passed — no conflicts with this record.</span></div>
        )}
        {warnings.map((w) => (
          <div key={w.message} className={`notice ${w.severity === 'major' ? 'crit' : w.severity === 'moderate' ? 'warn' : 'info'}`}>
            <Icon n="alert" s={15} /><span><b style={{ textTransform: 'uppercase', fontSize: 10 }}>{w.severity}</b> · {w.message}</span>
          </div>
        ))}
      </div>

      <div className="field" style={{ marginTop: 12 }}>
        <label htmlFor="tst">Diagnostic test</label>
        <span className="inp"><Icon n="scan" s={15} /><input id="tst" value={testOrder} disabled={signed} onChange={(e) => setTestOrder(e.target.value)} placeholder="e.g. Sputum smear × 2 · urgent" /></span>
      </div>
      <div className="field" style={{ marginTop: 11 }}>
        <label htmlFor="fup">Follow-up</label>
        <span className="inp"><Icon n="cal" s={15} /><input id="fup" type="datetime-local" value={followUp} disabled={signed} onChange={(e) => setFollowUp(e.target.value)} /></span>
      </div>
      <button className={`btn ${signed ? 'btn-g' : 'btn-p'} full`} style={{ marginTop: 14 }} disabled={signed || busy || !items.length} onClick={sign}>
        {busy ? <span className="spin" /> : <Icon n="check" s={16} />} {signed ? 'Sent to patient' : major ? 'Sign despite warning & send' : 'Sign & send to patient'}
      </button>
      <div className="tiny" style={{ marginTop: 9, textAlign: 'center', lineHeight: 1.5 }}>Signing files the prescription and consultation summary into Reports &amp; Care Records and notifies the patient instantly.</div>

      {adding && <MedicinePicker onClose={() => setAdding(false)} onPick={(m) => { setAdding(false); saveItems([...items, m]); toast(`${m.name} added`); }} />}
    </>
  );
}

function MedicinePicker({ onClose, onPick }: { onClose: () => void; onPick: (m: RxItem) => void }) {
  const [q, setQ] = useState('');
  const list = useLoad(() => api<(RxItem & { group: string })[]>(`/workspace/medicines?q=${encodeURIComponent(q)}`), [q]);
  const [custom, setCustom] = useState<RxItem>({ name: '', dose: '', frequency: '' });
  return (
    <Modal title="Add a medicine" eyebrow="FORMULARY · INTERACTION-CHECKED" onClose={onClose}>
      <span className="inp"><Icon n="search" s={16} /><input autoFocus value={q} onChange={(e) => setQ(e.target.value)} placeholder="Search medicine or class, e.g. rifampicin, macrolide" /></span>
      <div className="col" style={{ gap: 7, marginTop: 12, maxHeight: 300, overflowY: 'auto' }}>
        {list.data?.map((m) => (
          <button key={m.name} className="pick" style={{ border: '1px solid var(--line)' }} onClick={() => onPick({ name: m.name, dose: m.dose, frequency: m.frequency })}>
            <span className="grow"><b style={{ display: 'block', fontSize: 13 }}>{m.name}</b><span className="tiny">{m.group} · {m.frequency}</span></span>
            <span className="chip on">{m.dose}</span>
          </button>
        ))}
      </div>
      <details style={{ marginTop: 12 }}>
        <summary className="tiny" style={{ cursor: 'pointer' }}>Not in the list? Add a custom medicine</summary>
        <div className="col" style={{ gap: 8, marginTop: 10 }}>
          {(['name', 'dose', 'frequency'] as const).map((k) => (
            <span key={k} className="inp"><input placeholder={k[0].toUpperCase() + k.slice(1)} value={custom[k]} onChange={(e) => setCustom({ ...custom, [k]: e.target.value })} /></span>
          ))}
          <button className="btn btn-s sm" disabled={!custom.name || !custom.dose || !custom.frequency} onClick={() => onPick(custom)}>Add</button>
        </div>
      </details>
    </Modal>
  );
}
