import { useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { useAuth } from '../lib/auth';
import { Band, Head, Icon, Stat, useToast } from '../lib/ui';

/** Health Journey Tracker. */
const TREND: Record<string, { lab: string[]; v: number[] }> = {
  '6m': { lab: ['Apr', 'May', 'Jun', 'Jul', 'Aug', 'Sep'], v: [22, 26, 35, 44, 61, 78] },
  '12m': { lab: ['Oct', 'Dec', 'Feb', 'Apr', 'Jun', 'Aug', 'Sep'], v: [14, 17, 19, 22, 35, 61, 78] },
  all: { lab: ['2024', '', '2025', '', '2026', '', 'Sep'], v: [9, 11, 14, 18, 26, 52, 78] },
};
const TIMELINE = [
  { t: 'AI analysis: tuberculosis pattern', s: 'Smart Diagnosis Center', d: '17 Sep 2026', k: 'Diagnostics', tone: 'crit', ic: 'scan' },
  { t: 'Prescription signed', s: 'Dr Adeel Rehman', d: '17 Sep 2026', k: 'Prescriptions', tone: 'brand', ic: 'pill' },
  { t: 'Consultation · cough, fever, weight loss', s: 'Dr Adeel Rehman', d: '02 Sep 2026', k: 'Visits', tone: 'brand', ic: 'stet' },
  { t: 'Sputum smear · negative', s: 'Excel Labs', d: '28 Aug 2026', k: 'Diagnostics', tone: 'ok', ic: 'file' },
  { t: 'Baseline chest X-ray · normal', s: 'PIMS Radiology', d: '14 Jun 2026', k: 'Diagnostics', tone: 'ok', ic: 'scan' },
];

export default function Journey() {
  const { user } = useAuth();
  const toast = useToast();
  const nav = useNavigate();
  const [range, setRange] = useState<'6m' | '12m' | 'all'>('6m');
  const [filter, setFilter] = useState('All events');
  const [doses, setDoses] = useState([{ nm: 'Isoniazid 300 mg', pct: 95 }, { nm: 'Rifampicin 600 mg', pct: 89 }, { nm: 'Pyrazinamide 1,500 mg', pct: 74 }]);
  const adh = Math.round(doses.reduce((a, b) => a + b.pct, 0) / doses.length);
  const tl = TIMELINE.filter((e) => filter === 'All events' || e.k === filter);

  return (
    <>
      <Band title="Health journey tracker" sub={user?.role === 'DOCTOR' ? 'Patient journey for Ayesha Khan · PDX-10428 — risk trend, treatment adherence and every event in one timeline.' : 'Your care over time — risk trend, treatment adherence and every event in one timeline.'} art="/img/lungs-wide.jpg" />

      <div className="grid-kpi">
        <Stat label="Current risk band" icon="alert" tone="crit" value="High" sub="Predicted for the next 12 months" />
        <Stat label="Treatment adherence" icon="check" tone="ok" value={`${adh}%`} sub={`${Math.round(adh * 0.28)} of 28 doses logged`} />
        <Stat label="Next review" icon="cal" value="01 Oct" sub="Dr Adeel Rehman · 4:00 pm" />
      </div>

      <div className="row stack-lg" style={{ alignItems: 'flex-start' }}>
        <div className="col grow">
          <section className="card">
            <Head title="Predicted risk score" sub="0 = low risk · 100 = high risk"
              right={<div className="tabs">{(['6m', '12m', 'all'] as const).map((r) => <button key={r} className={range === r ? 'on' : ''} onClick={() => setRange(r)}>{r === 'all' ? 'All time' : r === '6m' ? '6 months' : '12 months'}</button>)}</div>} />
            <RiskChart d={TREND[range]} />
            <div className="notice crit" style={{ marginTop: 10 }}><Icon n="alert" s={16} /><span>Risk rose 17 points since August — an alert went to the treating doctor.</span></div>
          </section>
          <section className="card">
            <Head title="Journey timeline" right={<div className="ctr wrap" style={{ gap: 6 }}>{['All events', 'Diagnostics', 'Prescriptions', 'Visits'].map((f) => <button key={f} className={`chip${filter === f ? ' on' : ''}`} onClick={() => setFilter(f)}>{f}</button>)}</div>} />
            <div style={{ height: 14 }} />
            {tl.map((e, i) => (
              <div key={e.t} className="row" style={{ gap: 14 }}>
                <div className="col" style={{ alignItems: 'center', gap: 0, flexShrink: 0 }}>
                  <span style={{ width: 30, height: 30, borderRadius: '50%', display: 'grid', placeItems: 'center', background: 'var(--surface)', border: `2px solid var(--${e.tone})`, color: `var(--${e.tone})` }}><Icon n={e.ic} s={14} /></span>
                  {i < tl.length - 1 && <span style={{ width: 2, flex: 1, background: 'var(--line)', margin: '4px 0', minHeight: 22 }} />}
                </div>
                <div style={{ paddingBottom: i < tl.length - 1 ? 16 : 0 }}>
                  <b style={{ fontSize: 12.5 }}>{e.t}</b>
                  <div className="tiny" style={{ marginTop: 2 }}>{e.s} | {e.d}</div>
                </div>
              </div>
            ))}
          </section>
        </div>
        <div className="col side-340">
          <section className="card">
            <Head title="Treatment adherence" sub="Doses logged in the last 28 days" />
            <div style={{ height: 12 }} />
            {doses.map((d) => (
              <div key={d.nm} style={{ marginBottom: 12 }}>
                <div className="between" style={{ fontSize: 11.5, fontWeight: 600, color: 'var(--ink-2)' }}><span>{d.nm}</span><span className="num" style={{ color: 'var(--ink)', fontWeight: 800 }}>{d.pct}%</span></div>
                <div className="meter" style={{ marginTop: 5 }}><i style={{ width: `${d.pct}%`, background: d.pct >= 85 ? 'var(--ok)' : 'var(--warn)' }} /></div>
              </div>
            ))}
            <div className="ctr" style={{ gap: 9, background: 'var(--surface-2)', border: '1px solid var(--line)', borderRadius: 11, padding: 11 }}>
              <span style={{ color: 'var(--warn)' }}><Icon n="clock" s={15} /></span>
              <span className="grow" style={{ fontSize: 11.5, fontWeight: 600, color: 'var(--ink-2)' }}>Pyrazinamide is due at 8:00 pm.</span>
              <button className="btn btn-s xs" onClick={() => { setDoses(doses.map((x, i) => (i === 2 ? { ...x, pct: Math.min(100, x.pct + 4) } : x))); toast('Dose logged — adherence updated'); }}>Log dose</button>
            </div>
          </section>
          <section className="card">
            <Head title="Follow-ups &amp; orders" />
            <div className="list" style={{ marginTop: 6 }}>
              {[['Sputum smear × 2', 'Ordered 17 Sep · urgent', 'Pending', 'warn'], ['Follow-up consultation', '01 Oct 2026 · 4:00 pm', 'Booked', 'on'], ['Repeat chest X-ray', 'Due 17 Nov 2026', 'Scheduled', '']].map(([t, d, s, c]) => (
                <div key={t} className="between"><div><b style={{ fontSize: 12 }}>{t}</b><div className="tiny">{d}</div></div><span className={`chip ${c}`}>{s}</span></div>
              ))}
            </div>
            {user?.role === 'PATIENT' && <button className="btn btn-s full sm" style={{ marginTop: 11 }} onClick={() => nav('/app/portal')}><Icon n="cal" s={15} /> Schedule a review</button>}
          </section>
        </div>
      </div>
    </>
  );
}

function RiskChart({ d }: { d: { lab: string[]; v: number[] } }) {
  const [tip, setTip] = useState<{ x: number; y: number; v: number; l: string } | null>(null);
  const W = 660, H = 232, L = 38, R = 70, T = 14, B = 32, pw = W - L - R, ph = H - T - B;
  const X = (i: number) => L + i * (pw / (d.v.length - 1));
  const Y = (v: number) => T + ph - (v / 100) * ph;
  const band = (a: number, b: number, c: string) => <rect x={L} y={Y(b)} width={pw} height={Y(a) - Y(b)} fill={c} />;
  const pts = d.v.map((v, i) => `${X(i).toFixed(1)},${Y(v).toFixed(1)}`).join(' ');
  const last = d.v.length - 1, lv = d.v[last], lt = lv >= 66 ? 'crit' : lv >= 33 ? 'warn' : 'ok';
  const bandName = (v: number) => (v >= 66 ? 'high' : v >= 33 ? 'medium' : 'low');
  return (
    <div style={{ position: 'relative', marginTop: 12 }}>
      <svg viewBox={`0 0 ${W} ${H}`} style={{ width: '100%' }} role="img" aria-label={`Predicted chest disease risk rising to ${lv} out of 100, ${bandName(lv)} band`}>
        {band(66, 100, 'var(--crit-soft)')}{band(33, 66, 'var(--warn-soft)')}{band(0, 33, 'var(--ok-soft)')}
        {[0, 33, 66, 100].map((v) => <g key={v}><line x1={L} x2={L + pw} y1={Y(v)} y2={Y(v)} stroke="var(--line)" /><text x={L - 9} y={Y(v) + 4} textAnchor="end" fontSize="10" fill="var(--muted)" fontWeight="600">{v}</text></g>)}
        <text x={L + pw + 9} y={(Y(100) + Y(66)) / 2 + 4} fontSize="10" fontWeight="700" fill="var(--crit)">High</text>
        <text x={L + pw + 9} y={(Y(66) + Y(33)) / 2 + 4} fontSize="10" fontWeight="700" fill="var(--warn)">Medium</text>
        <text x={L + pw + 9} y={(Y(33) + Y(0)) / 2 + 4} fontSize="10" fontWeight="700" fill="var(--ok)">Low</text>
        <polygon points={`${L},${Y(0)} ${pts} ${X(last)},${Y(0)}`} fill="var(--brand)" opacity=".12" />
        <polyline points={pts} fill="none" stroke="var(--brand)" strokeWidth="2.4" strokeLinecap="round" strokeLinejoin="round" />
        {d.v.map((v, i) => <circle key={i} cx={X(i)} cy={Y(v)} r="4" fill="var(--surface)" stroke="var(--brand)" strokeWidth="2.2" />)}
        <circle cx={X(last)} cy={Y(lv)} r="5.6" fill={`var(--${lt})`} stroke="var(--surface)" strokeWidth="2.4" />
        {d.lab.map((m, i) => m && <text key={i} x={X(i)} y={T + ph + 19} textAnchor="middle" fontSize="10.5" fontWeight="600" fill="var(--muted)">{m}</text>)}
        {d.v.map((v, i) => (
          <rect key={`h${i}`} x={X(i) - pw / (d.v.length - 1) / 2} y={T} width={pw / (d.v.length - 1)} height={ph} fill="transparent" style={{ cursor: 'crosshair' }}
            onMouseEnter={() => setTip({ x: (X(i) / W) * 100, y: (Y(v) / H) * 100, v, l: d.lab[i] || `point ${i + 1}` })} onMouseLeave={() => setTip(null)} />
        ))}
      </svg>
      {tip && <div className="chart-tip" style={{ left: `${tip.x}%`, top: `${tip.y}%` }}>{tip.v} / 100<span>{tip.l} · {bandName(tip.v)} band</span></div>}
    </div>
  );
}
