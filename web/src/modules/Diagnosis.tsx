import { DragEvent, useEffect, useRef, useState } from 'react';
import { api, blobUrl } from '../lib/api';
import { useAuth } from '../lib/auth';
import { useSocketEvent } from '../lib/socket';
import { Band, bandTone, Empty, fmtDate, fmtTime, Head, Icon, useLoad, useToast } from '../lib/ui';

interface Result {
  isChestXray: boolean; reason?: string; notCxrProbability?: number;
  label: string; confidence: number; probabilities: Record<string, number>; gatePassed: boolean;
  assessment: { band: 'NORMAL' | 'SUSPICIOUS' | 'DISEASE'; text: string; diseaseProbability: number; heatmapFor: string };
  risk: {
    score: number; band: string; horizonMonths: number; condition: string; followUp: string;
    topFactors: { factor: string; weight: number }[]; clinicalProvided: boolean;
  };
  regions: { label: string; score: number; x: number; y: number; w: number; h: number }[];
  clinical: Clinical | null; imageSize: [number, number]; inferenceMs: number; model: { version: string };
}
const LABELS: Record<string, string> = { NORMAL: 'Normal', PNEUMONIA: 'Pneumonia', TUBERCULOSIS: 'Tuberculosis', OTHER: 'Other finding' };
const ASSESS = {
  NORMAL: { tone: 'ok', title: 'Normal', icon: 'check' },
  SUSPICIOUS: { tone: 'warn', title: 'Subtle finding · follow-up advised', icon: 'alert' },
  DISEASE: { tone: 'crit', title: 'Disease pattern detected', icon: 'alert' },
} as const;

interface Clinical {
  age?: number; coughDays?: number; spo2?: number; fever?: boolean; weightLoss?: boolean; nightSweats?: boolean;
  breathlessness?: boolean; smoker?: boolean; diabetes?: boolean; hivPositive?: boolean; tbContact?: boolean; priorTb?: boolean;
}
const SYMPTOMS: [keyof Clinical, string][] = [
  ['fever', 'Fever'], ['weightLoss', 'Weight loss'], ['nightSweats', 'Night sweats'], ['breathlessness', 'Breathless'],
  ['tbContact', 'TB contact'], ['priorTb', 'Previous TB'], ['smoker', 'Smoker'], ['diabetes', 'Diabetes'], ['hivPositive', 'HIV positive'],
];

interface Study { id: string; code: string; patient: { id: string; name: string; mrn: string }; view: string; status: string; originalName: string; createdAt: string; modelVersion: string | null; verifiedLabel: string | null; result: Result | null }
export default function Diagnosis() {
  const { user } = useAuth();
  const toast = useToast();
  const studies = useLoad(() => api<Study[]>('/diagnosis/studies'), []);
  const patients = useLoad(() => (user?.role === 'DOCTOR' ? api<{ id: string; name: string; mrn: string }[]>('/workspace/patients') : Promise.resolve([])), []);
  const [activeId, setActiveId] = useState<string | null>(null);
  const [img, setImg] = useState<string | null>(null);
  const [view, setView] = useState({ heat: true, boxes: true, grid: true, invert: false, op: 70 });
  const [run, setRun] = useState<{ id: string; step: number; steps: string[] } | null>(null);
  const [patientId, setPatientId] = useState('');
  const [over, setOver] = useState(false);
  const [uploading, setUploading] = useState(false);
  const [issues, setIssues] = useState<Record<string, 'accepted' | 'dismissed'>>({});
  const file = useRef<HTMLInputElement>(null);
  const [acting, setActing] = useState(false);
  const [heat, setHeat] = useState<string | null>(null);
  const [dims, setDims] = useState<[number, number] | null>(null);
  const [clinical, setClinical] = useState<Clinical>({});
  const [showForm, setShowForm] = useState(false);

  const list = studies.data ?? [];
  const st = list.find((s) => s.id === activeId) ?? list[0] ?? null;

  useEffect(() => {
    if (!patientId && patients.data?.length) setPatientId(patients.data[0].id);
  }, [patients.data]);

  useEffect(() => {
    if (!st) return;
    let url: string | null = null;
    setImg(null);
    setDims(null);
    blobUrl(`/diagnosis/studies/${st.id}/image`).then((u) => { url = u; setImg(u); }).catch(() => setImg('/img/xray-chest.jpg'));
    return () => { if (url) URL.revokeObjectURL(url); };
  }, [st?.id, st?.status === 'ANALYSED']);

  // the model's activation heatmap, a transparent PNG the same shape as the X-ray
  useEffect(() => {
    setHeat(null);
    if (!st || st.status !== 'ANALYSED') return;
    let url: string | null = null;
    blobUrl(`/diagnosis/studies/${st.id}/heatmap`).then((u) => { url = u; setHeat(u); }).catch(() => null);
    return () => { if (url) URL.revokeObjectURL(url); };
  }, [st?.id, st?.status, st?.result?.inferenceMs]);

  useEffect(() => { setClinical(st?.result?.clinical ?? {}); setShowForm(false); }, [st?.id]);

  useSocketEvent<{ id: string; step: number; steps: string[] }>('study:progress', (p) => setRun(p));
  useSocketEvent<{ id: string; result: Result }>('study:done', (p) => {
    setRun(null);
    studies.reload();
    toast(`Analysis complete — ${p.result.label} at ${p.result.confidence}%`);
  });
  useSocketEvent<{ id: string; reason: string }>('study:rejected', (p) => { setRun(null); toast(`Not a chest X-ray — ${p.reason}`, 'err'); studies.reload(); });
  useSocketEvent<{ id: string; message?: string }>('study:failed', (p) => { setRun(null); toast(p.message ?? 'Analysis failed', 'err'); studies.reload(); });

  const upload = async (f: File) => {
    if (!patientId) return toast('Pick a patient first', 'err');
    if (f.size > 20 * 1024 * 1024) return toast('That file is over 20 MB', 'err');
    const form = new FormData();
    form.append('file', f);
    form.append('patientId', patientId);
    form.append('view', 'PA');
    setUploading(true);
    try {
      const r = await api<{ id: string; code: string }>('/diagnosis/studies', { form });
      toast(`Study ${r.code} uploaded — press Run AI analysis`);
      await studies.reload();
      setActiveId(r.id);
    } catch (e) {
      toast((e as Error).message, 'err');
    } finally {
      setUploading(false);
    }
  };
  const onDrop = (e: DragEvent) => {
    e.preventDefault();
    setOver(false);
    const f = e.dataTransfer.files[0];
    if (f) upload(f);
  };
  /** Files a signed AI report into the patient's records, or refers the study to radiology. */
  /** The doctor's confirmed diagnosis for this X-ray (also the label used to train the model). */
  const confirm = async (label: string) => {
    if (!st) return;
    try {
      await api(`/diagnosis/studies/${st.id}/label`, { method: 'PATCH', body: { label } });
      studies.setData((l) => l?.map((x) => (x.id === st.id ? { ...x, verifiedLabel: label } : x)) ?? l);
      toast(`Diagnosis confirmed: ${LABELS[label]}`);
    } catch (e) {
      toast((e as Error).message, 'err');
    }
  };

  const act = async (what: 'report' | 'refer') => {
    if (!st) return;
    const accepted = Object.entries(issues).filter(([k, v]) => k.startsWith(st.id) && v === 'accepted').length;
    const path = what === 'report'
      ? `/diagnosis/studies/${st.id}/report`
      : `/diagnosis/studies/${st.id}/refer`;
    setActing(true);
    try {
      const r = await api<{ message: string }>(path, { body: what === 'report' ? { acceptedFindings: accepted } : {} });
      toast(r.message);
      studies.reload();
    } catch (e) {
      toast((e as Error).message, 'err');
    } finally {
      setActing(false);
    }
  };

  const analyse = async () => {
    if (!st) return;
    const filled = Object.fromEntries(Object.entries(clinical).filter(([, v]) => v !== undefined && v !== '' && !(typeof v === 'number' && Number.isNaN(v))));
    try {
      const r = await api<{ steps: string[] }>(`/diagnosis/studies/${st.id}/analyse`, { body: Object.keys(filled).length ? { clinical: filled } : {} });
      setRun({ id: st.id, step: 0, steps: r.steps });
      studies.setData((l) => l?.map((s) => (s.id === st.id ? { ...s, status: 'ANALYSING' } : s)) ?? l);
    } catch (e) {
      toast((e as Error).message, 'err');
    }
  };

  const r = st?.result;
  const legacy = !!r && !('isChestXray' in r); // made by the old preview stand-in: analyse again
  const done = st?.status === 'ANALYSED' && !!r && !legacy && r.isChestXray;
  const rejected = st?.status === 'REJECTED' && !!r;
  const probs = done ? Object.entries(r!.probabilities).sort((a, b) => b[1] - a[1]) : [];
  const assess = done ? ASSESS[r!.assessment.band] : ASSESS.NORMAL;
  const tone = assess.tone;
  const size = (done && r!.imageSize) || dims;
  const frame = size
    ? (size[0] >= size[1] ? { width: '100%' } : { height: '100%' })
    : { width: '100%', height: '100%' };
  const setC = (k: keyof Clinical, v: number | boolean | undefined) => setClinical((c) => ({ ...c, [k]: v }));
  const numIn = (k: 'age' | 'coughDays' | 'spo2', label: string, min: number, max: number) => (
    <label className="field" style={{ margin: 0 }}>
      <span className="tiny">{label}</span>
      <span className="inp"><input type="number" min={min} max={max} value={clinical[k] ?? ''}
        onChange={(e) => setC(k, e.target.value === '' ? undefined : Math.max(min, Math.min(max, +e.target.value)))} /></span>
    </label>
  );

  return (
    <>
      <Band title="Smart diagnostic center" sub="Upload chest X-rays and get AI-assisted analysis with heatmaps, marked regions and a 12-month risk prediction."
        art="/img/xray-chest.jpg" />

      <div className="row stack-lg" style={{ alignItems: 'stretch' }}>
        {/* ------------------------------------------------ queue + upload */}
        <section className="card side-240">
          <Head title="Studies queue" sub={`${list.length} studies`} />
          {user?.role === 'DOCTOR' && (
            <>
              <div className="field" style={{ marginTop: 12 }}>
                <label htmlFor="pt">Patient</label>
                <span className="inp"><select id="pt" value={patientId} onChange={(e) => setPatientId(e.target.value)}>
                  {patients.data?.map((p) => <option key={p.id} value={p.id}>{p.name} · {p.mrn}</option>)}
                </select></span>
              </div>
              <div className={`dropzone${over ? ' over' : ''}`} style={{ marginTop: 10 }} onDragOver={(e) => { e.preventDefault(); setOver(true); }} onDragLeave={() => setOver(false)} onDrop={onDrop}>
                <div style={{ color: 'var(--brand)' }}><Icon n="up" s={22} /></div>
                <div style={{ fontSize: 12.5, fontWeight: 700, marginTop: 7 }}>Drop a chest X-ray</div>
                <div className="tiny" style={{ marginTop: 3 }}>PNG, JPG, WEBP or DICOM · up to 20 MB</div>
                <button className="btn btn-s sm" style={{ marginTop: 10 }} disabled={uploading} onClick={() => file.current?.click()}>{uploading ? <span className="spin" /> : null} Browse files</button>
                <input ref={file} type="file" accept=".png,.jpg,.jpeg,.webp,.bmp,.dcm,image/png,image/jpeg,image/webp,image/bmp,application/dicom" hidden onChange={(e) => { const f = e.target.files?.[0]; if (f) upload(f); e.target.value = ''; }} />
              </div>
            </>
          )}
          <div className="col" style={{ gap: 3, marginTop: 12 }}>
            {list.map((s) => (
              <button key={s.id} className={`pick${s.id === st?.id ? ' on' : ''}`} onClick={() => setActiveId(s.id)}>
                <span style={{ width: 34, height: 34, borderRadius: 8, overflow: 'hidden', background: '#000', flexShrink: 0 }}><img src="/img/xray-chest.jpg" alt="" style={{ width: '100%', height: '100%', objectFit: 'cover' }} /></span>
                <span className="grow"><b className="mono" style={{ display: 'block', fontSize: 10.5 }}>{s.code}</b><span className="tiny">{s.patient.name} · {s.view}</span></span>
                <span className={`chip ${s.status === 'REJECTED' || s.status === 'FAILED' ? 'crit' : s.status === 'ANALYSED' ? (s.result?.gatePassed ? 'ai' : 'warn') : s.status === 'ANALYSING' ? 'on' : ''}`} style={{ fontSize: 9, padding: '3px 7px' }}>
                  {s.status === 'REJECTED' ? 'Not X-ray' : s.status === 'FAILED' ? 'Failed' : s.status === 'ANALYSED' ? (s.result && !('isChestXray' in s.result) ? 'Re-run' : s.result?.gatePassed ? 'Ready' : 'Low conf') : s.status === 'ANALYSING' ? 'Running' : 'New'}
                </span>
              </button>
            ))}
            {studies.data && !list.length && <Empty icon="scan" title="No studies yet">Upload a chest X-ray to begin.</Empty>}
          </div>
        </section>

        {/* ------------------------------------------------ viewer */}
        <section className="suite grow" style={{ minWidth: 0 }}>
          <div className="sbar">
            {(['heat', 'boxes', 'grid', 'invert'] as const).map((k) => (
              <button key={k} className={`sbtn${view[k] ? ' on' : ''}`} onClick={() => setView({ ...view, [k]: !view[k] })}>
                {{ heat: 'Heatmap', boxes: 'Lesion boxes', grid: 'Measurements grid', invert: 'Invert' }[k]}
              </button>
            ))}
            <span className="grow" />
            <label className="ctr" style={{ fontSize: 11, fontWeight: 600, color: '#7d93ad' }}>
              Heat {view.op}%
              <input type="range" min={0} max={100} value={view.op} onChange={(e) => setView({ ...view, op: +e.target.value })} aria-label="Heatmap opacity" />
            </label>
          </div>
          <div className="stage" style={{ display: 'grid', placeItems: 'center' }}>
            {/* frame has the X-ray's own shape, so the heatmap and boxes line up with the film */}
            <div style={{ position: 'relative', maxWidth: '100%', maxHeight: '100%', ...frame, ...(size ? { aspectRatio: `${size[0]} / ${size[1]}` } : {}) }}>
              {img ? <img className="film" src={img} alt={`Chest X-ray ${st?.code ?? ''}`} style={{ filter: view.invert ? 'invert(1)' : 'none', display: 'block' }}
                onLoad={(e) => setDims([e.currentTarget.naturalWidth, e.currentTarget.naturalHeight])} /> : <div className="skeleton" style={{ position: 'absolute', inset: 0, borderRadius: 0 }} />}
              {done && view.heat && heat && assess !== ASSESS.NORMAL && (
                <img className="heat" src={heat} alt="" style={{ width: '100%', height: '100%', opacity: view.op / 100, mixBlendMode: 'normal' }} />
              )}
              {done && view.boxes && r!.regions.map((g, i) => (
                <div key={i} className="bbox" style={{ left: `${g.x}%`, top: `${g.y}%`, width: `${g.w}%`, height: `${g.h}%` }}>
                  <b style={{ background: '#ff6b4a' }}>{g.label.toUpperCase()} · {g.score}</b>
                </div>
              ))}
            </div>
            {view.grid && <div className="grid" />}
            {rejected && !run && (
              <div style={{ position: 'absolute', inset: 0, display: 'grid', placeItems: 'center', textAlign: 'center', padding: 24, background: 'rgba(40,6,6,.72)' }}>
                <div style={{ maxWidth: 380 }}>
                  <div className="mono" style={{ fontSize: 12, color: '#ff8a7a', fontWeight: 800 }}>NOT A CHEST X-RAY · NOT ANALYSED</div>
                  <div style={{ color: '#f4d7d2', fontSize: 13, marginTop: 8 }}>{r!.reason}</div>
                  <div className="tiny" style={{ color: '#c9a39c', marginTop: 6 }}>Upload a frontal chest X-ray (PNG, JPG, WEBP or DICOM).</div>
                </div>
              </div>
            )}
            {run && run.id === st?.id && (
              <div style={{ position: 'absolute', inset: 0, display: 'grid', placeItems: 'center', background: 'rgba(4,7,13,.78)', backdropFilter: 'blur(2px)' }}>
                <div style={{ width: 'min(340px, 82%)' }}>
                  <div className="mono" style={{ fontSize: 11, color: '#3fd7ef', textAlign: 'center' }}>ANALYSING {st.code}</div>
                  <div style={{ height: 12 }} />
                  {run.steps.map((p, i) => (
                    <div key={p} className="ctr" style={{ gap: 8, fontSize: 11.5, fontWeight: 600, marginBottom: 6, color: i < run.step ? '#4cd8a6' : i === run.step ? '#3fd7ef' : '#57708c' }}>
                      <span style={{ width: 13 }}>{i < run.step ? '✓' : i === run.step ? '▸' : '·'}</span><span className="grow">{p}</span>
                    </div>
                  ))}
                  <div className="meter" style={{ background: 'rgba(214,230,242,.16)' }}><i style={{ width: `${((run.step + 1) / run.steps.length) * 100}%`, background: '#3fd7ef' }} /></div>
                </div>
              </div>
            )}
            {st && !done && !rejected && !run && st.status !== 'ANALYSING' && (
              <div style={{ position: 'absolute', inset: 0, display: 'grid', placeItems: 'center', textAlign: 'center', padding: 24, background: 'rgba(4,7,13,.35)' }}>
                <div>
                  <div className="mono" style={{ fontSize: 11, color: '#9fb4d0' }}>STUDY LOADED · NOT YET ANALYSED</div>
                  <button className="btn btn-p" style={{ marginTop: 12 }} onClick={analyse}>Run AI analysis</button>
                </div>
              </div>
            )}
            <div className="filmnote">{st ? `${st.code} · ${st.view} · ${st.originalName}` : 'No study selected'}</div>
          </div>
          <div className="suitefoot">
            <span className="mono">{st?.patient.name ?? '–'}</span>
            <span className="mono">{st ? `acquired ${fmtDate(st.createdAt)} ${fmtTime(st.createdAt)}` : ''}</span>
            <span className="mono">{done ? `${r!.model.version} · ${(r!.inferenceMs / 1000).toFixed(1)} s` : st?.status === 'ANALYSING' ? 'running' : rejected ? 'rejected: not a chest X-ray' : 'queued'}</span>
            <span className="grow" />
            <span className="ctr" style={{ gap: 6 }}><span style={{ width: 10, height: 10, borderRadius: 3, background: '#ff6b4a' }} />high activation</span>
            <span className="ctr" style={{ gap: 6 }}><span style={{ width: 10, height: 10, borderRadius: 3, background: '#ffc24a' }} />moderate</span>
          </div>
        </section>

        {/* ------------------------------------------------ AI analysis */}
        <section className="card side-300">
          <Head title="AI analysis" right={<span className={`chip ${done ? 'ok' : rejected ? 'crit' : 'warn'}`}>{done ? 'Completed' : rejected ? 'Rejected' : 'Pending'}</span>} />
          <div className="notice warn" style={{ marginTop: 12 }}><Icon n="alert" s={15} /><span>AI results support clinical judgement — a doctor reviews every finding before a report is released.</span></div>
          {done ? (
            <>
              <div style={{ background: `var(--${tone}-soft)`, border: `1px solid var(--${tone})`, borderRadius: 14, padding: 14, marginTop: 12 }}>
                <div className="eyebrow" style={{ color: `var(--${tone})` }}>{assess.title}</div>
                <div style={{ fontFamily: 'var(--font-d)', fontSize: 23, fontWeight: 800, marginTop: 3 }}>{r!.label}</div>
                <div className="tiny" style={{ color: 'var(--ink-2)', marginTop: 4 }}>{r!.confidence}% confidence · {r!.gatePassed ? 'above' : 'below'} the 70% auto-report gate</div>
                <div style={{ fontSize: 12, marginTop: 8 }}>{r!.assessment.text}</div>
                {r!.assessment.band !== 'NORMAL' && <div className="tiny" style={{ marginTop: 4 }}>Heatmap shows where the model sees {r!.assessment.heatmapFor.toLowerCase()} · disease probability {r!.assessment.diseaseProbability}%</div>}
              </div>
              {!r!.gatePassed && <div className="notice warn" style={{ marginTop: 10 }}><Icon n="alert" s={15} /><span>Routed to radiologist review — no report is released on the model alone.</span></div>}
              <div className="eyebrow" style={{ marginTop: 15 }}>Class probabilities</div>
              {probs.map(([k, v], i) => (
                <div key={k} style={{ marginTop: 9 }}>
                  <div className="between" style={{ fontSize: 12.5, fontWeight: i ? 600 : 800 }}><span>{k}</span><span className="mono">{v}%</span></div>
                  <div className="meter" style={{ marginTop: 5 }}><i style={{ width: `${v}%`, background: i ? 'var(--brand)' : `var(--${tone})` }} /></div>
                </div>
              ))}
              <div className="eyebrow" style={{ marginTop: 15 }}>Detected regions</div>
              <div className="list">
                {r!.regions.map((g, i) => {
                  const key = `${st!.id}-${i}`;
                  return (
                    <div key={key} className="ctr" style={{ gap: 8 }}>
                      <span className="dot" style={{ background: issues[key] === 'accepted' ? 'var(--ok)' : issues[key] === 'dismissed' ? 'var(--muted)' : 'var(--crit)' }} />
                      <span className="grow" style={{ fontSize: 12, fontWeight: 600 }}>{g.label} <span className="mono tiny">{g.score}</span></span>
                      {issues[key] ? <span className="chip">{issues[key]}</span> : (
                        <>
                          <button className="btn btn-s xs" onClick={() => { setIssues({ ...issues, [key]: 'accepted' }); toast('Finding accepted into the report'); }}>Accept</button>
                          <button className="btn btn-g xs" onClick={() => { setIssues({ ...issues, [key]: 'dismissed' }); toast('Finding dismissed'); }}>Dismiss</button>
                        </>
                      )}
                    </div>
                  );
                })}
                {!r!.regions.length && <div className="tiny">No regions above the detection threshold.</div>}
              </div>
              <div style={{ background: 'var(--surface-2)', border: '1px solid var(--line)', borderRadius: 12, padding: 12, marginTop: 12 }}>
                <div className="between"><b style={{ fontSize: 12 }}>Future risk · {r!.risk.condition}</b><span className={`chip ${bandTone(r!.risk.band)}`}>{r!.risk.band} · {r!.risk.score}</span></div>
                <div className="meter" style={{ marginTop: 9 }}><i style={{ width: `${r!.risk.score}%`, background: `var(--${bandTone(r!.risk.band)})` }} /></div>
                <div style={{ fontSize: 12, marginTop: 9 }}><b>Follow-up:</b> {r!.risk.followUp}</div>
                {r!.risk.topFactors.length > 0 && <div className="tiny" style={{ marginTop: 6 }}>Based on: {r!.risk.topFactors.map((f) => f.factor).join(' · ')}</div>}
                {!r!.risk.clinicalProvided && <div className="tiny" style={{ marginTop: 6, color: 'var(--warn)' }}>X-ray only. Add the patient's symptoms below for a better estimate.</div>}
                <div className="tiny" style={{ marginTop: 6 }}>Next {r!.risk.horizonMonths} months · rule-based estimate (WHO TB screening criteria), not a certainty.</div>
              </div>
              <div style={{ background: 'var(--surface-2)', border: '1px solid var(--line)', borderRadius: 12, padding: 12, marginTop: 12 }}>
                <button className="between full" style={{ background: 'none', border: 0, padding: 0, cursor: 'pointer', color: 'inherit' }} onClick={() => setShowForm(!showForm)}>
                  <b style={{ fontSize: 12 }}>Symptoms &amp; history</b><span className="tiny">{showForm ? 'Hide' : r!.risk.clinicalProvided ? 'Edit' : 'Add'}</span>
                </button>
                {showForm && (
                  <>
                    <div className="row" style={{ gap: 8, marginTop: 10 }}>
                      {numIn('age', 'Age', 0, 120)}{numIn('coughDays', 'Cough (days)', 0, 365)}{numIn('spo2', 'SpO₂ %', 50, 100)}
                    </div>
                    <div className="ctr wrap" style={{ gap: 6, marginTop: 10 }}>
                      {SYMPTOMS.map(([k, label]) => (
                        <button key={k} className={`chip${clinical[k] ? ' on' : ''}`} onClick={() => setC(k, !clinical[k])}>{label}</button>
                      ))}
                    </div>
                    <button className="btn btn-s sm full" style={{ marginTop: 10 }} onClick={analyse}>Re-run with symptoms</button>
                  </>
                )}
              </div>
              <div style={{ background: 'var(--surface-2)', border: '1px solid var(--line)', borderRadius: 12, padding: 12, marginTop: 12 }}>
                <div className="between"><b style={{ fontSize: 12 }}>Doctor's confirmed diagnosis</b>{st!.verifiedLabel ? <span className="chip ok">Confirmed</span> : <span className="chip warn">Pending</span>}</div>
                <div className="ctr wrap" style={{ gap: 6, marginTop: 9 }}>
                  {Object.entries(LABELS).map(([k, v]) => (
                    <button key={k} className={`chip${st!.verifiedLabel === k ? ' on' : ''}`} onClick={() => confirm(k)}>{v}</button>
                  ))}
                </div>
              </div>
              <div className="tiny" style={{ marginTop: 10 }}>Analysed {fmtDate(st!.createdAt)} · {st!.code}</div>
              <button className="btn btn-p full" style={{ marginTop: 12 }} disabled={acting} onClick={() => act('report')}><Icon n="file" s={16} /> Generate diagnostic report</button>
              <button className="btn btn-g full" style={{ marginTop: 8 }} disabled={acting} onClick={() => act('refer')}><Icon n="share" s={16} /> Send to radiologist</button>
            </>
          ) : rejected ? (
            <div className="notice crit" style={{ marginTop: 12 }}><Icon n="alert" s={15} />
              <span><b>Not a chest X-ray.</b> {r!.reason} Nothing was diagnosed. Upload a frontal chest X-ray instead.</span>
            </div>
          ) : (
            <>
              <Empty icon="scan" title="Nothing to show yet">
                Run the analysis on this study to see probabilities, the heatmap and the future-risk estimate.
              </Empty>
              {st && st.status !== 'ANALYSING' && (
                <div style={{ background: 'var(--surface-2)', border: '1px solid var(--line)', borderRadius: 12, padding: 12, marginTop: 4 }}>
                  <b style={{ fontSize: 12 }}>Symptoms &amp; history <span className="tiny">(optional, improves the risk estimate)</span></b>
                  <div className="row" style={{ gap: 8, marginTop: 10 }}>
                    {numIn('age', 'Age', 0, 120)}{numIn('coughDays', 'Cough (days)', 0, 365)}{numIn('spo2', 'SpO₂ %', 50, 100)}
                  </div>
                  <div className="ctr wrap" style={{ gap: 6, marginTop: 10 }}>
                    {SYMPTOMS.map(([k, label]) => (
                      <button key={k} className={`chip${clinical[k] ? ' on' : ''}`} onClick={() => setC(k, !clinical[k])}>{label}</button>
                    ))}
                  </div>
                  <button className="btn btn-p full" style={{ marginTop: 12 }} onClick={analyse}>Run AI analysis</button>
                </div>
              )}
            </>
          )}
        </section>
      </div>

    </>
  );
}

