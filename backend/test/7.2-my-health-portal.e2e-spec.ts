import request from 'supertest';
import { API, auth, boot, connect, newPatient, nextEvent, signIn } from './helpers';

describe('7.2 My Health Portal - doctor finder, booking, payment', () => {
  let ctx: Awaited<ReturnType<typeof boot>>;
  let doctorId = '';
  beforeAll(async () => {
    ctx = await boot();
    const p = await newPatient(ctx.http);
    const r = await request(ctx.http).get(`${API}/doctors?q=Zeeshan`).set(auth(p)).expect(200);
    doctorId = r.body.results[0].id;
  });
  afterAll(async () => ctx.app.close());
  const get = (path: string, s: any) => request(ctx.http).get(`${API}${path}`).set(auth(s));
  const post = (path: string, s: any, body: object) => request(ctx.http).post(`${API}${path}`).set(auth(s)).send(body);

  it('TC-31 lists only verified doctors, with filters and sorting', async () => {
    const p = await newPatient(ctx.http);
    const all = await get('/doctors', p).expect(200);
    expect(all.body.results.length).toBeGreaterThanOrEqual(6);
    expect(all.body.results.every((d: any) => !/Usman Qureshi|Farah Naz/.test(d.name))).toBe(true); // pending licences hidden
    const lahore = await get('/doctors?city=Lahore', p).expect(200);
    expect(lahore.body.results.every((d: any) => d.city === 'Lahore')).toBe(true);
    const fee = await get('/doctors?sort=fee', p).expect(200);
    const fees = fee.body.results.map((d: any) => d.fee);
    expect(fees).toEqual([...fees].sort((a, b) => a - b));
    const radiology = await get('/doctors?specialization=Radiology', p).expect(200);
    expect(radiology.body.results.map((d: any) => d.name)).toContain('Dr Sana Malik');
    expect(radiology.body.results.every((d: any) => d.specialization === 'Radiology')).toBe(true);
    const q = await get('/doctors?q=pims', p).expect(200);
    expect(q.body.results.length).toBeGreaterThan(0);
  });

  it('TC-60 near me: distance from the patient, nearest first, with the real hospital and OPD timings', async () => {
    const p = await newPatient(ctx.http);
    // A patient standing at Faizabad, Islamabad
    const r = await get('/doctors?sort=nearest&lat=33.6630&lng=73.0840', p).expect(200);
    // doctors without a known hospital location have no distance and are listed last
    const d = r.body.results.map((x: any) => x.distanceKm).filter((x: any) => x !== null);
    expect(d.length).toBeGreaterThan(20);
    const firstNull = r.body.results.findIndex((x: any) => x.distanceKm === null);
    if (firstNull >= 0) expect(r.body.results.slice(firstNull).every((x: any) => x.distanceKm === null)).toBe(true);
    expect(d).toEqual([...d].sort((a: number, b: number) => a - b));
    const first = r.body.results[0];
    expect(first.facility).toMatchObject({ name: expect.any(String), area: expect.any(String), lat: expect.any(Number) });
    expect(first.schedule).toMatch(/am|pm/);
    const karachi = r.body.results.find((x: any) => x.city === 'Karachi');
    expect(karachi.distanceKm).toBeGreaterThan(1000);
    await get('/doctors?lat=200&lng=73', p).expect(400);
  });

  it('TC-61 hospital and clinic directory by city, nearest first', async () => {
    const p = await newPatient(ctx.http);
    const all = await get('/doctors/facilities', p).expect(200);
    expect(all.body.length).toBeGreaterThanOrEqual(20);
    expect(new Set(all.body.map((f: any) => f.city))).toEqual(new Set(['Islamabad', 'Rawalpindi', 'Lahore', 'Karachi']));
    const lahore = await get('/doctors/facilities?city=Lahore&lat=31.52&lng=74.35', p).expect(200);
    expect(lahore.body.every((f: any) => f.city === 'Lahore')).toBe(true);
    expect(lahore.body.map((f: any) => f.name)).toContain('Gulab Devi Chest Hospital');
    const dist = lahore.body.map((f: any) => f.distanceKm);
    expect(dist).toEqual([...dist].sort((a: number, b: number) => a - b));
  });

  it('TC-32 slot list only offers future, free slots', async () => {
    const p = await newPatient(ctx.http);
    const r = await get(`/doctors/${doctorId}/slots`, p).expect(200);
    expect(r.body.slots.length).toBeGreaterThan(0);
    expect(r.body.slots.every((s: any) => new Date(s.startAt).getTime() > Date.now())).toBe(true);
  });

  it('TC-33 hold -> pay -> confirmed, with real-time notifications to both sides', async () => {
    const p = await newPatient(ctx.http, 'Booking Patient');
    const doc = await signIn(ctx.http, 'z.ahmed@predictdx.com', 'DOCTOR');
    const doctorSocket = await connect(ctx.base, doc.token);
    const patientSocket = await connect(ctx.base, p.token);

    const slots = await get(`/doctors/${doctorId}/slots`, p).expect(200);
    const startAt = slots.body.slots[0].startAt;
    const held = await post('/appointments', p, { doctorId, startAt, reason: 'Fever' }).expect(201);
    expect(held.body.status).toBe('PENDING_PAYMENT');
    expect(held.body.payment.status).toBe('PENDING');
    expect(new Date(held.body.holdExpiresAt).getTime()).toBeGreaterThan(Date.now());

    const summary = await get('/portal/summary', p).expect(200);
    expect(summary.body.outstanding).toBe(held.body.doctor.fee);

    const docNotified = nextEvent(doctorSocket, 'notification', (n: any) => n.type === 'appointment.new');
    const patientUpdated = nextEvent(patientSocket, 'appointment:update', (a: any) => a.id === held.body.id);
    const paid = await post(`/appointments/${held.body.id}/pay`, p, { method: 'EASYPAISA' }).expect(200);
    expect(paid.body.status).toBe('CONFIRMED');
    expect(paid.body.payment).toMatchObject({ status: 'PAID', method: 'EASYPAISA' });
    expect(paid.body.payment.txRef).toMatch(/^TXN-/);
    expect((await docNotified).body).toMatch(/Booking Patient/);
    expect((await patientUpdated).status).toBe('CONFIRMED');

    await post(`/appointments/${held.body.id}/pay`, p, { method: 'EASYPAISA' }).expect(409); // cannot pay twice
    const after = await get(`/doctors/${doctorId}/slots`, p).expect(200);
    expect(after.body.slots.map((s: any) => s.startAt)).not.toContain(startAt);
    doctorSocket.disconnect();
    patientSocket.disconnect();
  });

  it('TC-34 the same slot cannot be booked twice (race-safe unique constraint)', async () => {
    const a = await newPatient(ctx.http);
    const b = await newPatient(ctx.http);
    const slots = await get(`/doctors/${doctorId}/slots`, a).expect(200);
    const startAt = slots.body.slots[1].startAt;
    const [r1, r2] = await Promise.all([
      post('/appointments', a, { doctorId, startAt }),
      post('/appointments', b, { doctorId, startAt }),
    ]);
    expect([r1.status, r2.status].sort()).toEqual([201, 409]);
    expect((r1.status === 409 ? r1 : r2).body.message).toMatch(/just booked this slot/);
  });

  it('TC-35 rejects a time the doctor does not offer, and invalid payment methods', async () => {
    const p = await newPatient(ctx.http);
    const odd = new Date(Date.now() + 3 * 86_400_000);
    odd.setHours(3, 17, 0, 0);
    await post('/appointments', p, { doctorId, startAt: odd.toISOString() }).expect(400);
    const slots = await get(`/doctors/${doctorId}/slots`, p).expect(200);
    const held = await post('/appointments', p, { doctorId, startAt: slots.body.slots[2].startAt }).expect(201);
    await post(`/appointments/${held.body.id}/pay`, p, { method: 'BITCOIN' }).expect(400);
  });

  it('TC-36 a patient cannot pay for, cancel or see someone else\'s appointment', async () => {
    const owner = await newPatient(ctx.http);
    const intruder = await newPatient(ctx.http);
    const slots = await get(`/doctors/${doctorId}/slots`, owner).expect(200);
    const held = await post('/appointments', owner, { doctorId, startAt: slots.body.slots[3].startAt }).expect(201);
    await post(`/appointments/${held.body.id}/pay`, intruder, { method: 'CARD' }).expect(404);
    await request(ctx.http).patch(`${API}/appointments/${held.body.id}/cancel`).set(auth(intruder)).expect(404);
    const mine = await get('/appointments/mine', intruder).expect(200);
    expect(mine.body.upcoming).toHaveLength(0);
  });

  it('TC-37 cancel refunds a paid visit and frees the slot; reschedule moves it', async () => {
    const p = await newPatient(ctx.http);
    const slots = await get(`/doctors/${doctorId}/slots`, p).expect(200);
    const [s1, s2] = [slots.body.slots[4].startAt, slots.body.slots[5].startAt];
    const held = await post('/appointments', p, { doctorId, startAt: s1 }).expect(201);
    await post(`/appointments/${held.body.id}/pay`, p, { method: 'CARD' }).expect(200);

    const moved = await request(ctx.http).patch(`${API}/appointments/${held.body.id}/reschedule`).set(auth(p)).send({ startAt: s2 }).expect(200);
    expect(moved.body.startAt).toBe(s2);
    const free = await get(`/doctors/${doctorId}/slots`, p).expect(200);
    expect(free.body.slots.map((s: any) => s.startAt)).toContain(s1);

    const c = await request(ctx.http).patch(`${API}/appointments/${held.body.id}/cancel`).set(auth(p)).expect(200);
    expect(c.body).toMatchObject({ status: 'CANCELLED', refunded: true });
    expect(c.body.payment.status).toBe('REFUNDED');
    const again = await get(`/doctors/${doctorId}/slots`, p).expect(200);
    expect(again.body.slots.map((s: any) => s.startAt)).toContain(s2);
    await request(ctx.http).patch(`${API}/appointments/${held.body.id}/cancel`).set(auth(p)).expect(409);
  });

  it('TC-38 portal summary and records only ever show the patient\'s own data', async () => {
    const ayesha = await signIn(ctx.http, 'ayesha.khan@predictdx.com', 'PATIENT');
    const s = await get('/portal/summary', ayesha).expect(200);
    expect(s.body.recentRecords.length).toBeGreaterThan(0);
    const recs = await get('/records', ayesha).expect(200);
    expect(recs.body.every((r: any) => r.patient.user.fullName === 'Ayesha Khan')).toBe(true);
    const other = await newPatient(ctx.http);
    await get(`/records/${recs.body[0].id}`, other).expect(403);
  });
});
