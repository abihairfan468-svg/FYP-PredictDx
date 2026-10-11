import { useEffect, useMemo, useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { api, ApiError } from '../lib/api';
import { useAuth } from '../lib/auth';
import { useSocketEvent } from '../lib/socket';
import { Avatar, Band, Empty, fmtDate, fmtWhen, Head, Icon, Modal, rs, Stat, useLoad, useToast } from '../lib/ui';

export interface Appt {
  id: string;
  startAt: string;
  status: string;
  reason: string | null;
  holdExpiresAt: string | null;
  doctor: { id: string; userId: string; name: string; specialization: string; hospital: string; room: string; fee: number };
  patient: { id: string; userId: string; name: string; mrn: string };
  payment: { status: string; amount: number; invoiceNo: string; method: string | null; paidAt: string | null; txRef: string | null } | null;
}
interface Facility { id: string; name: string; type: string; sector: string; area: string; address: string; lat: number; lng: number }
interface Doctor {
  id: string; userId: string; name: string; specialization: string; qualification: string; hospital: string; city: string;
  fee: number; rating: number; reviews: number; experienceYears: number; availableToday: boolean;
  nextSlot: { startAt: string; label: string; day: string } | null;
  freeSlotsThisWeek: number; schedule: string; languages: string; bio: string | null; room: string;
  online: boolean; facility: Facility | null; distanceKm: number | null;
}
type BookingDoctor = Pick<Doctor, 'id' | 'name' | 'fee' | 'specialization' | 'hospital' | 'city' | 'qualification'> & Partial<Pick<Doctor, 'facility' | 'schedule'>>;

/** Used when the patient does not share a location: the centre of their city. */
const CITY_CENTRE: Record<string, [number, number]> = {
  Islamabad: [33.6844, 73.0479], Rawalpindi: [33.5651, 73.0169], Lahore: [31.5204, 74.3587], Karachi: [24.8607, 67.0011],
};
const km = (d: number) => (d < 1 ? `${Math.round(d * 1000)} m` : `${d.toFixed(1)} km`);
/** Google Maps finds the hospital by name + address (the stored coordinates are approximate). */
const place = (f: Facility) => encodeURIComponent(`${f.name}, ${f.address}`);
const mapsUrl = (f: Facility) => `https://www.google.com/maps/dir/?api=1&destination=${place(f)}`;
const mapEmbed = (f: Facility) => `https://maps.google.com/maps?q=${place(f)}&z=15&output=embed`;
interface Summary { nextAppointment: Appt | null; newReports: number; activePrescriptions: number; outstanding: number; recentRecords: { id: string; title: string; kind: string; createdAt: string }[] }

const STATUS: Record<string, [string, string]> = {
  PENDING_PAYMENT: ['Awaiting payment', 'warn'], CONFIRMED: ['Confirmed', 'ok'], CHECKED_IN: ['Checked in', 'ai'],
  IN_CONSULTATION: ['With doctor now', 'on'], COMPLETED: ['Completed', ''], CANCELLED: ['Cancelled', 'crit'],
};

export default function Portal() {
  const { user } = useAuth();
  const toast = useToast();
  const nav = useNavigate();
  const [q, setQ] = useState({ text: '', specialization: 'All', city: 'All', today: false, sort: 'soonest' });
  const [debounced, setDebounced] = useState('');
  const [booking, setBooking] = useState<{ doctor: BookingDoctor; reschedule?: Appt } | null>(null);
  const [here, setHere] = useState<{ lat: number; lng: number; label: string } | null>(null);
  const [locating, setLocating] = useState(false);

  /** "Near me": the device location if allowed, otherwise the patient's city centre. */
  const nearMe = () => {
    if (here) {
      setHere(null);
      setQ((p) => ({ ...p, sort: 'soonest' }));
      return;
    }
    const fallback = () => {
      const c = CITY_CENTRE[user?.patient?.city ?? ''] ?? CITY_CENTRE.Islamabad;
      setHere({ lat: c[0], lng: c[1], label: `${user?.patient?.city ?? 'Islamabad'} centre` });
      setQ((p) => ({ ...p, sort: 'nearest' }));
      setLocating(false);
    };
    if (!navigator.geolocation) return fallback();
    setLocating(true);
    navigator.geolocation.getCurrentPosition(
      (pos) => {
        setHere({ lat: pos.coords.latitude, lng: pos.coords.longitude, label: 'your location' });
        setQ((p) => ({ ...p, sort: 'nearest' }));
        setLocating(false);
      },
      () => {
        toast('Location not shared — showing doctors nearest your city centre');
        fallback();
      },
      { timeout: 8000, maximumAge: 300_000 },
    );
  };
  const [cancelling, setCancelling] = useState<Appt | null>(null);
  const [paying, setPaying] = useState<Appt | null>(null);

  useEffect(() => {
    const t = setTimeout(() => setDebounced(q.text), 250);
    return () => clearTimeout(t);
  }, [q.text]);

  const filters = useLoad(() => api<{ specializations: string[]; cities: string[] }>('/doctors/filters'), []);
  const docs = useLoad(() => {
    const p = new URLSearchParams({ sort: q.sort });
    if (debounced) p.set('q', debounced);
    if (q.specialization !== 'All') p.set('specialization', q.specialization);
    if (q.city !== 'All') p.set('city', q.city);
    if (q.today) p.set('availableToday', 'true');
    if (here) {
      p.set('lat', String(here.lat));
      p.set('lng', String(here.lng));
    }
    return api<{ total: number; results: Doctor[] }>(`/doctors?${p}`);
  }, [debounced, q.specialization, q.city, q.today, q.sort, here?.lat, here?.lng]);
  const summary = useLoad(() => api<Summary>('/portal/summary'), []);
  const mine = useLoad(() => api<{ upcoming: Appt[]; past: Appt[] }>('/appointments/mine'), []);

  const refreshAll = () => {
    summary.reload();
    mine.reload();
    docs.reload();
  };
  useSocketEvent('appointment:update', refreshAll);
  useSocketEvent('notification', (n: { type: string }) => n.type.startsWith('prescription') && summary.reload());

  const s = summary.data;
  const next = s?.nextAppointment;
  const upcoming = mine.data?.upcoming ?? [];

  const message = async (doctorUserId: string) => {
    try {
      const t = await api<{ id: string }>('/chat/threads', { body: { userId: doctorUserId } });
      nav(`/app/careconnect?thread=${t.id}`);
    } catch (e) {
      toast((e as Error).message, 'err');
    }
  };

  return (
    <>
      <Band title="My health portal" sub={`Assalam o alaikum ${user?.fullName.split(' ')[0]} · ${user?.patient?.mrn}. Find a chest specialist, book and pay, and keep every report in one place.`} art="/img/card-importance.jpg" />

      <div className="grid-kpi">
        <Stat label="Next appointment" small icon="cal" value={next ? fmtWhen(next.startAt) : 'None booked'} sub={next ? `${next.doctor.name} · ${next.doctor.room}` : 'Book a chest specialist below'} />
        <Stat label="Reports this week" icon="file" tone="brand" value={`${s?.newReports ?? '–'} new`} sub="Reports & Care Records" />
        <Stat label="Active prescriptions" icon="pill" tone="ok" value={s?.activePrescriptions ?? '–'} sub="Signed in the last 60 days" />
        <Stat label="Outstanding payment" icon="wallet" tone={s?.outstanding ? 'warn' : 'ok'} value={s ? rs(s.outstanding) : '–'} sub={s?.outstanding ? 'Finish payment to keep your slot' : 'Nothing due'} />
      </div>

      <div className="row stack-lg" style={{ alignItems: 'flex-start' }}>
        {/* ------------------------------------------------ doctor finder */}
        <section className="card grow">
          <Head title="Find a chest specialist" sub={docs.data ? `${docs.data.results.length} of ${docs.data.total} verified doctors match` : 'Loading doctors…'} right={<span className="chip ai"><Icon n="act" s={13} /> live availability</span>} />
          <div style={{ height: 14 }} />
          <span className="inp">
            <Icon n="search" s={17} />
            <input type="search" placeholder="Search name, speciality, hospital or city" value={q.text} onChange={(e) => setQ({ ...q, text: e.target.value })} aria-label="Search doctors" />
            <select value={q.sort} onChange={(e) => setQ({ ...q, sort: e.target.value })} aria-label="Sort doctors" style={{ flex: '0 0 auto', fontWeight: 700, fontSize: 12, color: 'var(--brand)' }}>
              <option value="soonest">Soonest first</option>
              <option value="fee">Lowest fee</option>
              <option value="rating">Highest rated</option>
              {here && <option value="nearest">Nearest first</option>}
            </select>
          </span>
          <div style={{ height: 11 }} />
          <div className="ctr wrap" style={{ gap: 7 }}>
            {['All', ...(filters.data?.specializations ?? [])].map((sp) => (
              <button key={sp} className={`chip${q.specialization === sp ? ' on' : ''}`} onClick={() => setQ({ ...q, specialization: sp })}>{sp === 'All' ? 'All specialities' : sp}</button>
            ))}
            <span style={{ width: 1, height: 18, background: 'var(--line)' }} />
            {(filters.data?.cities ?? []).map((c) => (
              <button key={c} className={`chip${q.city === c ? ' on' : ''}`} onClick={() => setQ({ ...q, city: q.city === c ? 'All' : c })}>{c}</button>
            ))}
            <button className={`chip${q.today ? ' on' : ''}`} onClick={() => setQ({ ...q, today: !q.today })}>Available today</button>
            <button className={`chip${here ? ' on' : ''}`} onClick={nearMe} disabled={locating}><Icon n="home" s={12} /> {locating ? 'Finding you…' : here ? `Near ${here.label}` : 'Near me'}</button>
          </div>
          <div style={{ height: 6 }} />
          {docs.error && <div className="notice crit" style={{ marginTop: 10 }}>{docs.error}</div>}
          <div className="list">
            {docs.loading && !docs.data && [0, 1, 2].map((i) => <div key={i}><div className="skeleton" style={{ height: 48 }} /></div>)}
            {docs.data?.results.map((d) => (
              <div key={d.id} className="doc-card">
                <Avatar name={d.name} size={46} cls={d.specialization === 'Radiology' ? 'c2' : ''} />
                <div style={{ minWidth: 0 }}>
                  <div className="ctr" style={{ gap: 7, fontSize: 14, fontWeight: 700 }}>{d.name}{d.online && <span className="chip ok" style={{ fontSize: 9.5, padding: '2px 7px' }}><span className="dot" style={{ background: 'var(--ok)', width: 6, height: 6 }} /> Online</span>}</div>
                  <div className="tiny" style={{ color: 'var(--ink-2)' }}>{d.specialization} · {d.qualification} · {d.experienceYears} yrs</div>
                  <div className="tiny">{d.facility ? `${d.facility.name} · ${d.facility.area}, ${d.city}` : `${d.hospital} · ${d.city}`}</div>
                  <div className="tiny" style={{ marginTop: 2 }}><Icon n="clock" s={11} /> {d.schedule}{d.distanceKm != null && <> · <b style={{ color: 'var(--brand)' }}>{km(d.distanceKm)}</b> away</>}</div>
                </div>
                <div className="doc-card-price">
                  <div style={{ fontSize: 12, fontWeight: 700 }}>★ {d.rating} <span className="tiny">({d.reviews})</span></div>
                  <div className="num" style={{ fontSize: 13, fontWeight: 700, marginTop: 3 }}>{d.fee ? rs(d.fee) : 'Free'}</div>
                  <div className="tiny">{d.freeSlotsThisWeek} slots this week</div>
                </div>
                <div className="col doc-card-actions" style={{ gap: 7 }}>
                  <span className={`chip ${d.availableToday ? 'ok' : ''}`}>{d.nextSlot ? `${d.nextSlot.day} ${d.nextSlot.label}` : 'Fully booked'}</span>
                  <button className="btn btn-p sm" disabled={!d.nextSlot} onClick={() => setBooking({ doctor: d })}>Book slot</button>
                  {d.facility && <a className="btn btn-g xs" href={mapsUrl(d.facility)} target="_blank" rel="noreferrer" title={`Directions to ${d.facility.name} in Google Maps`}><Icon n="send" s={12} /> Directions</a>}
                </div>
              </div>
            ))}
            {docs.data && !docs.data.results.length && <Empty icon="search" title="No doctor matches those filters">Clear a filter to widen the search.</Empty>}
          </div>
        </section>

        {/* ------------------------------------------------ right column */}
        <div className="col side-340">
          <section className="card">
            <Head title="Upcoming appointments" right={<span className="chip">{upcoming.length}</span>} />
            <div className="list" style={{ marginTop: 6 }}>
              {upcoming.map((a) => (
                <div key={a.id}>
                  <div className="ctr" style={{ gap: 12 }}>
                    <Avatar name={a.doctor.name} size={40} cls="c2" />
                    <div className="grow">
                      <div style={{ fontSize: 13.5, fontWeight: 700 }}>{a.doctor.name}</div>
                      <div className="tiny">{a.doctor.specialization} · {a.doctor.room}</div>
                    </div>
                    <span className={`chip ${STATUS[a.status]?.[1]}`}>{STATUS[a.status]?.[0]}</span>
                  </div>
                  <dl className="kv" style={{ gridTemplateColumns: '1fr 1fr', marginTop: 11 }}>
                    <div><dt>Date &amp; time</dt><dd>{fmtWhen(a.startAt)}</dd></div>
                    <div><dt>{a.payment?.status === 'PAID' ? 'Fee paid' : 'Fee due'}</dt><dd className="num">{rs(a.payment?.amount ?? a.doctor.fee)}</dd></div>
                  </dl>
                  <div className="ctr wrap" style={{ gap: 8, marginTop: 11 }}>
                    {a.status === 'PENDING_PAYMENT' ? (
                      <button className="btn btn-p sm" onClick={() => setPaying(a)}>Pay now</button>
                    ) : a.status === 'CONFIRMED' ? (
                      <button className="btn btn-g sm" onClick={() => setBooking({ doctor: { id: a.doctor.id, name: a.doctor.name, fee: a.doctor.fee, specialization: a.doctor.specialization, hospital: a.doctor.hospital, city: '', qualification: '' }, reschedule: a })}>Reschedule</button>
                    ) : null}
                    {['PENDING_PAYMENT', 'CONFIRMED', 'CHECKED_IN'].includes(a.status) && <button className="btn btn-d sm" onClick={() => setCancelling(a)}>Cancel</button>}
                    {a.status !== 'PENDING_PAYMENT' && <button className="btn btn-s sm" onClick={() => message(a.doctor.userId)}><Icon n="chat" s={14} /> Message</button>}
                  </div>
                </div>
              ))}
              {!mine.loading && !upcoming.length && <Empty icon="cal" title="No upcoming visit">Book a chest specialist from the finder.</Empty>}
            </div>
          </section>

          <section className="card">
            <Head title="Reports &amp; prescriptions" right={<button className="btn-link" onClick={() => nav('/app/records')}>View all</button>} />
            <div className="list" style={{ marginTop: 6 }}>
              {s?.recentRecords.map((r) => (
                <button key={r.id} className="pick" style={{ padding: '10px 4px', borderRadius: 0 }} onClick={() => nav(`/app/records?id=${r.id}`)}>
                  <span style={{ width: 34, height: 34, borderRadius: 10, display: 'grid', placeItems: 'center', background: 'var(--brand-soft)', color: 'var(--brand)', flexShrink: 0 }}>
                    <Icon n={r.kind === 'AI report' || r.kind === 'Imaging' ? 'scan' : r.kind === 'Prescription' ? 'pill' : 'file'} s={16} />
                  </span>
                  <span className="grow"><b style={{ display: 'block', fontSize: 12.5 }}>{r.title}</b><span className="tiny">{fmtDate(r.createdAt)}</span></span>
                  {Date.now() - new Date(r.createdAt).getTime() < 7 * 86_400_000 ? <span className="chip ai">New</span> : <span className="chip ok">Signed</span>}
                </button>
              ))}
              {s && !s.recentRecords.length && <div className="tiny" style={{ padding: 14 }}>Your reports appear here once a doctor signs them.</div>}
            </div>
          </section>

          {mine.data && mine.data.past.length > 0 && (
            <section className="card">
              <Head title="Past visits" />
              <div className="list" style={{ marginTop: 6 }}>
                {mine.data.past.slice(0, 4).map((a) => (
                  <div key={a.id} className="between">
                    <div><b style={{ fontSize: 12.5 }}>{a.doctor.name}</b><div className="tiny">{fmtDate(a.startAt)} · {a.payment?.invoiceNo}</div></div>
                    <span className={`chip ${STATUS[a.status]?.[1]}`}>{STATUS[a.status]?.[0]}{a.payment?.status === 'REFUNDED' ? ' · refunded' : ''}</span>
                  </div>
                ))}
              </div>
            </section>
          )}
        </div>
      </div>

      {booking && <BookModal {...booking} onClose={() => setBooking(null)} onDone={(a) => { setBooking(null); refreshAll(); if (a.status === 'PENDING_PAYMENT') setPaying(a); }} />}
      {paying && <PayModal appt={paying} onClose={() => { setPaying(null); refreshAll(); }} />}
      {cancelling && (
        <Modal title="Cancel this appointment?" eyebrow="CANCEL APPOINTMENT" onClose={() => setCancelling(null)}>
          <p className="h-sub">{cancelling.doctor.name} · {fmtWhen(cancelling.startAt)}. The slot is released for other patients{cancelling.payment?.status === 'PAID' ? ` and ${rs(cancelling.payment.amount)} is refunded to your ${cancelling.payment.method?.toLowerCase()} account` : ''}.</p>
          <div className="ctr" style={{ gap: 9, marginTop: 18 }}>
            <button className="btn btn-g grow" onClick={() => setCancelling(null)}>Keep it</button>
            <button className="btn btn-d grow" onClick={async () => {
              try {
                const r = await api<{ refunded: boolean }>(`/appointments/${cancelling.id}/cancel`, { method: 'PATCH' });
                toast(r.refunded ? 'Appointment cancelled — refund issued' : 'Appointment cancelled — the slot is released');
                setCancelling(null);
                refreshAll();
              } catch (e) {
                toast((e as Error).message, 'err');
              }
            }}>Cancel appointment</button>
          </div>
        </Modal>
      )}
    </>
  );
}

/* ------------------------------------------------------------------ booking / reschedule */
function BookModal({ doctor, reschedule, onClose, onDone }: { doctor: BookingDoctor; reschedule?: Appt; onClose: () => void; onDone: (a: Appt) => void }) {
  const toast = useToast();
  const slots = useLoad(() => api<{ slots: { startAt: string; label: string; day: string }[] }>(`/doctors/${doctor.id}/slots`), [doctor.id]);
  const [pick, setPick] = useState<string | null>(null);
  const [reason, setReason] = useState('');
  const [busy, setBusy] = useState(false);
  const [err, setErr] = useState<string | null>(null);

  const days = useMemo(() => {
    const m = new Map<string, { startAt: string; label: string }[]>();
    for (const s of slots.data?.slots ?? []) m.set(s.day, [...(m.get(s.day) ?? []), s]);
    return [...m.entries()];
  }, [slots.data]);
  const [day, setDay] = useState<string | null>(null);
  useEffect(() => {
    if (days.length && !day) setDay(days[0][0]);
  }, [days, day]);

  const submit = async () => {
    if (!pick) return;
    setBusy(true);
    setErr(null);
    try {
      if (reschedule) {
        const a = await api<Appt>(`/appointments/${reschedule.id}/reschedule`, { method: 'PATCH', body: { startAt: pick } });
        toast(`Moved to ${fmtWhen(a.startAt)}`);
        onDone(a);
      } else {
        const a = await api<Appt>('/appointments', { body: { doctorId: doctor.id, startAt: pick, ...(reason.trim() ? { reason: reason.trim() } : {}) } });
        onDone(a);
      }
    } catch (e) {
      setErr((e as Error).message);
      if (e instanceof ApiError && e.status === 409) {
        setPick(null);
        slots.reload();
      }
    } finally {
      setBusy(false);
    }
  };

  return (
    <Modal title={`${reschedule ? 'Reschedule with' : 'Book'} ${doctor.name}`} eyebrow={reschedule ? 'RESCHEDULE' : 'NEW APPOINTMENT'} onClose={onClose}>
      {!reschedule && (
        <div className="ctr" style={{ gap: 12, marginBottom: 14 }}>
          <Avatar name={doctor.name} size={44} />
          <div className="grow">
            <b style={{ fontSize: 13.5 }}>{doctor.specialization} · {doctor.qualification}</b>
            <div className="tiny">{doctor.facility ? doctor.facility.address : `${doctor.hospital} · ${doctor.city}`}</div>
            {doctor.schedule && <div className="tiny"><Icon n="clock" s={11} /> {doctor.schedule}</div>}
          </div>
          {doctor.facility && <a className="btn btn-g xs" href={mapsUrl(doctor.facility)} target="_blank" rel="noreferrer"><Icon n="send" s={12} /> Directions</a>}
        </div>
      )}
      {!reschedule && doctor.facility && (
        <iframe
          title={`Map of ${doctor.facility.name}`}
          src={mapEmbed(doctor.facility)}
          loading="lazy"
          referrerPolicy="no-referrer-when-downgrade"
          style={{ width: '100%', height: 190, border: '1px solid var(--line)', borderRadius: 12, marginBottom: 14, display: 'block' }}
        />
      )}
      <div className="eyebrow">Pick a day</div>
      <div className="ctr wrap" style={{ gap: 7, marginTop: 8 }}>
        {slots.loading && <span className="tiny"><span className="spin" /> Checking availability…</span>}
        {days.map(([d]) => <button key={d} className={`chip${day === d ? ' on' : ''}`} onClick={() => { setDay(d); setPick(null); }}>{d}</button>)}
        {slots.data && !days.length && <span className="tiny">No free slots in the next 7 days.</span>}
      </div>
      <div className="eyebrow" style={{ marginTop: 14 }}>Pick a time</div>
      <div className="ctr wrap" style={{ gap: 8, marginTop: 8 }}>
        {days.find(([d]) => d === day)?.[1].map((s) => (
          <button key={s.startAt} className={`chip${pick === s.startAt ? ' on' : ''}`} style={{ padding: '7px 13px', fontSize: 12 }} onClick={() => setPick(s.startAt)}>{s.label}</button>
        ))}
      </div>
      {!reschedule && (
        <div className="field" style={{ marginTop: 14 }}>
          <label htmlFor="reason">Reason for visit (optional)</label>
          <span className="inp"><input id="reason" maxLength={200} value={reason} onChange={(e) => setReason(e.target.value)} placeholder="e.g. cough for two weeks" /></span>
        </div>
      )}
      <dl className="kv" style={{ gridTemplateColumns: '1fr 1fr', marginTop: 14 }}>
        <div><dt>Consultation fee</dt><dd className="num">{rs(doctor.fee)}</dd></div>
        <div><dt>{reschedule ? 'Current slot' : 'Slot hold'}</dt><dd>{reschedule ? fmtWhen(reschedule.startAt) : '10 minutes while you pay'}</dd></div>
      </dl>
      <div className="notice info" style={{ marginTop: 12 }}>
        <Icon n="lock" s={15} />
        <span>Your slot is held for 10 minutes while you complete the payment.</span>
      </div>
      {err && <div className="notice crit" style={{ marginTop: 10 }} role="alert"><Icon n="alert" s={15} /><span>{err}</span></div>}
      <button className="btn btn-p full" style={{ marginTop: 16, padding: 13 }} disabled={!pick || busy} onClick={submit}>
        {busy && <span className="spin" />} {reschedule ? 'Move my appointment' : `Hold slot and pay ${rs(doctor.fee)}`}
      </button>
    </Modal>
  );
}

/* ------------------------------------------------------------------ payment */
function PayModal({ appt, onClose }: { appt: Appt; onClose: () => void }) {
  const toast = useToast();
  const [method, setMethod] = useState('JAZZCASH');
  const [busy, setBusy] = useState(false);
  const [err, setErr] = useState<string | null>(null);
  const [left, setLeft] = useState(() => Math.max(0, Math.round((new Date(appt.holdExpiresAt ?? 0).getTime() - Date.now()) / 1000)));
  useEffect(() => {
    const t = setInterval(() => setLeft((l) => Math.max(0, l - 1)), 1000);
    return () => clearInterval(t);
  }, []);

  const pay = async () => {
    setBusy(true);
    setErr(null);
    try {
      const a = await api<Appt>(`/appointments/${appt.id}/pay`, { body: { method } });
      toast(`Appointment confirmed with ${a.doctor.name} · ${a.payment?.txRef}`);
      onClose();
    } catch (e) {
      setErr((e as Error).message);
    } finally {
      setBusy(false);
    }
  };

  return (
    <Modal title={`Pay ${rs(appt.payment?.amount ?? appt.doctor.fee)}`} eyebrow="SECURE PAYMENT" onClose={onClose}>
      <div className="between">
        <div><b style={{ fontSize: 13.5 }}>{appt.doctor.name}</b><div className="tiny">{fmtWhen(appt.startAt)} · invoice {appt.payment?.invoiceNo}</div></div>
        <span className={`chip ${left < 60 ? 'crit' : 'warn'}`}><Icon n="clock" s={12} /> {Math.floor(left / 60)}:{String(left % 60).padStart(2, '0')}</span>
      </div>
      <div className="eyebrow" style={{ marginTop: 16 }}>Pay with</div>
      <div className="col" style={{ gap: 8, marginTop: 8 }}>
        {[['JAZZCASH', 'JazzCash', 'Mobile wallet'], ['EASYPAISA', 'EasyPaisa', 'Mobile wallet'], ['CARD', 'Debit / credit card', 'Visa · Mastercard · UnionPay']].map(([k, t, d]) => (
          <label key={k} className={`pick${method === k ? ' on' : ''}`} style={{ border: '1px solid var(--line)', cursor: 'pointer' }}>
            <input type="radio" name="pm" checked={method === k} onChange={() => setMethod(k)} />
            <span className="grow"><b style={{ display: 'block', fontSize: 13 }}>{t}</b><span className="tiny">{d}</span></span>
            <Icon n={k === 'CARD' ? 'card' : 'wallet'} s={17} />
          </label>
        ))}
      </div>
      <div className="notice warn" style={{ marginTop: 12 }}>
        <Icon n="alert" s={15} />
        <span>You will be asked to approve the payment in your JazzCash, EasyPaisa or banking app.</span>
      </div>
      {err && <div className="notice crit" style={{ marginTop: 10 }} role="alert"><Icon n="alert" s={15} /><span>{err}</span></div>}
      <button className="btn btn-p full" style={{ marginTop: 16, padding: 13 }} disabled={busy || left === 0} onClick={pay}>
        {busy && <span className="spin" />} {left === 0 ? 'Hold expired — book again' : `Confirm and pay ${rs(appt.payment?.amount ?? appt.doctor.fee)}`}
      </button>
    </Modal>
  );
}
