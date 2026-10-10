import request from 'supertest';
import { API, auth, bookAndPay, boot, connect, newPatient, nextEvent, signIn } from './helpers';

describe('7.3 Doctor Workspace - queue, consultation, prescriptions', () => {
  let ctx: Awaited<ReturnType<typeof boot>>;
  let doctor: Awaited<ReturnType<typeof signIn>>;
  let doctorId = '';
  beforeAll(async () => {
    ctx = await boot();
    doctor = await signIn(ctx.http, 'j.bushra@predictdx.com', 'DOCTOR');
    doctorId = doctor.user.doctor.id;
  });
  afterAll(async () => ctx.app.close());
  const ws = (path: string) => `${API}/workspace${path}`;

  it('TC-39 a paid booking appears in the doctor\'s queue for that day', async () => {
    const p = await newPatient(ctx.http, 'Queue Patient');
    const appt = await bookAndPay(ctx.http, p, doctorId);
    const day = new Date(appt.startAt);
    const iso = `${day.getFullYear()}-${String(day.getMonth() + 1).padStart(2, '0')}-${String(day.getDate()).padStart(2, '0')}`;
    const r = await request(ctx.http).get(ws(`/day?date=${iso}`)).set(auth(doctor)).expect(200);
    expect(r.body.appointments.map((a: any) => a.id)).toContain(appt.id);
    expect(r.body.doctor.name).toBe('Dr Javeria Bushra');
  });

  it('TC-40 unpaid holds are not shown in the queue', async () => {
    const p = await newPatient(ctx.http);
    const slots = await request(ctx.http).get(`${API}/doctors/${doctorId}/slots`).set(auth(p)).expect(200);
    const held = await request(ctx.http).post(`${API}/appointments`).set(auth(p)).send({ doctorId, startAt: slots.body.slots[0].startAt }).expect(201);
    const d = new Date(held.body.startAt);
    const iso = `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}-${String(d.getDate()).padStart(2, '0')}`;
    const r = await request(ctx.http).get(ws(`/day?date=${iso}`)).set(auth(doctor)).expect(200);
    expect(r.body.appointments.map((a: any) => a.id)).not.toContain(held.body.id);
  });

  it('TC-41 visit status only moves forward, and the patient is notified live', async () => {
    const p = await newPatient(ctx.http, 'Status Patient');
    const appt = await bookAndPay(ctx.http, p, doctorId);
    const sock = await connect(ctx.base, p.token);
    const status = (s: string) => request(ctx.http).patch(ws(`/appointments/${appt.id}/status`)).set(auth(doctor)).send({ status: s });

    await status('COMPLETED').expect(409); // cannot skip the consultation
    await status('CHECKED_IN').expect(200);
    const called = nextEvent(sock, 'notification', (n: any) => n.type === 'visit.called');
    await status('IN_CONSULTATION').expect(200);
    expect((await called).body).toMatch(/Room 3/);
    await status('CHECKED_IN').expect(409); // no going back
    await status('COMPLETED').expect(200);
    sock.disconnect();
  });

  it('TC-42 consultation note and vitals autosave and merge', async () => {
    const p = await newPatient(ctx.http);
    const appt = await bookAndPay(ctx.http, p, doctorId);
    const put = (body: object) => request(ctx.http).put(ws(`/appointments/${appt.id}/consultation`)).set(auth(doctor)).send(body).expect(200);
    await put({ vitals: { bp: '120 / 80', spo2: '97%' } });
    await put({ vitals: { temp: '37.9 °C' }, notes: 'Productive cough, crackles at right base.' });
    const d = await request(ctx.http).get(ws(`/appointments/${appt.id}`)).set(auth(doctor)).expect(200);
    expect(d.body.consultation.vitals).toEqual({ bp: '120 / 80', spo2: '97%', temp: '37.9 °C' });
    expect(d.body.consultation.notes).toMatch(/crackles/);
  });

  it('TC-43 interaction checker flags dangerous combinations and allergies', async () => {
    const hira = await signIn(ctx.http, 'hira.saleem@predictdx.com', 'PATIENT'); // has a penicillin allergy flag
    const appt = await bookAndPay(ctx.http, hira, doctorId);
    const draft = await request(ctx.http).put(ws(`/appointments/${appt.id}/prescription`)).set(auth(doctor)).send({
      items: [
        { name: 'Rifampicin', dose: '600 mg', frequency: 'Once daily' },
        { name: 'Clarithromycin', dose: '500 mg', frequency: 'Twice daily' },
        { name: 'Amoxicillin', dose: '500 mg', frequency: 'Three times daily' },
      ],
    }).expect(200);
    const msgs = draft.body.warnings.map((w: any) => `${w.severity}: ${w.message}`).join('\n');
    expect(msgs).toMatch(/major: Rifampicin \+ Clarithromycin/);
    expect(msgs).toMatch(/major: Patient has a recorded penicillin allergy/);
    expect(draft.body.code).toMatch(/^RX-/);
  });

  it('TC-44 sign & send files records, notifies the patient in real time, and locks the prescription', async () => {
    const p = await newPatient(ctx.http, 'Rx Patient');
    const appt = await bookAndPay(ctx.http, p, doctorId);
    const sock = await connect(ctx.base, p.token);
    await request(ctx.http).post(ws(`/appointments/${appt.id}/prescription/sign`)).set(auth(doctor)).expect(400); // nothing to sign
    await request(ctx.http).put(ws(`/appointments/${appt.id}/consultation`)).set(auth(doctor)).send({ notes: 'Community-acquired pneumonia.', testOrder: 'CBC', followUpAt: new Date(Date.now() + 7 * 86_400_000).toISOString() }).expect(200);
    await request(ctx.http).put(ws(`/appointments/${appt.id}/prescription`)).set(auth(doctor)).send({ items: [{ name: 'Amoxicillin', dose: '500 mg', frequency: 'Three times daily · 7 days' }] }).expect(200);

    const notified = nextEvent(sock, 'notification', (n: any) => n.type === 'prescription.signed');
    const signed = await request(ctx.http).post(ws(`/appointments/${appt.id}/prescription/sign`)).set(auth(doctor)).expect(200);
    expect(signed.body.status).toBe('SIGNED');
    expect((await notified).title).toBe('New prescription');

    const recs = await request(ctx.http).get(`${API}/records`).set(auth(p)).expect(200);
    const kinds = recs.body.map((r: any) => r.kind);
    expect(kinds).toEqual(expect.arrayContaining(['Prescription', 'Note']));
    const rx = recs.body.find((r: any) => r.kind === 'Prescription');
    expect(rx.body).toMatch(/Amoxicillin 500 mg/);
    expect(rx.body).toMatch(/Diagnostic test: CBC/);
    expect(rx.body).toMatch(/PMDC 47311/);

    await request(ctx.http).put(ws(`/appointments/${appt.id}/prescription`)).set(auth(doctor)).send({ items: [] }).expect(409);
    await request(ctx.http).post(ws(`/appointments/${appt.id}/prescription/sign`)).set(auth(doctor)).expect(409);
    sock.disconnect();
  });

  it('TC-45 a doctor cannot open another doctor\'s patient or appointment', async () => {
    const p = await newPatient(ctx.http);
    const appt = await bookAndPay(ctx.http, p, doctorId);
    const other = await signIn(ctx.http, 'a.faheem@predictdx.com', 'DOCTOR');
    await request(ctx.http).get(ws(`/appointments/${appt.id}`)).set(auth(other)).expect(404);
    await request(ctx.http).put(ws(`/appointments/${appt.id}/consultation`)).set(auth(other)).send({ notes: 'x' }).expect(404);
    await request(ctx.http).get(`${API}/records?patientId=${p.user.patient.id}`).set(auth(other)).expect(403);
    await request(ctx.http).get(`${API}/records?patientId=${p.user.patient.id}`).set(auth(doctor)).expect(200);
  });

  it('TC-46 formulary search', async () => {
    const r = await request(ctx.http).get(ws('/medicines?q=macrolide')).set(auth(doctor)).expect(200);
    expect(r.body.map((m: any) => m.name).sort()).toEqual(['Azithromycin', 'Clarithromycin']);
  });
});
