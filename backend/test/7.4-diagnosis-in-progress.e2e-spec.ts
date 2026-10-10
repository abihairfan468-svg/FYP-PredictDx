import request from 'supertest';
import { readFileSync } from 'fs';
import { resolve } from 'path';
import { createServer, Server } from 'http';
import { AddressInfo } from 'net';
import { API, auth, boot, connect, nextEvent, signIn } from './helpers';

/**
 * Stand-in for the Python AI service (ai-service/), so these tests check the backend's side of the
 * contract without TensorFlow: a file named cat* is answered as "not a chest X-ray", anything else
 * as a tuberculosis finding in the same JSON shape ai-service/app/main.py returns.
 */
function fakeAiService(): Promise<Server> {
  const png = Buffer.from('iVBORw0KGgoAAAANSUhEUgAAAAEAAAABCAYAAAAfFcSJAAAADUlEQVR42mP8z8DwHwAFBQIAX8jx0gAAAABJRU5ErkJggg==', 'base64');
  const server = createServer((req, res) => {
    let body = '';
    req.on('data', (c) => (body += c.toString('latin1')));
    req.on('end', () => {
      if (req.headers['x-internal-key'] !== process.env.AI_INTERNAL_KEY) { res.writeHead(401).end(); return; }
      const cat = /filename="cat/.test(body);
      const model = { name: 'test', version: 'test-model' };
      const out = cat
        ? { isChestXray: false, reason: 'The model recognises this as a photo or object, not a chest X-ray.', notCxrProbability: 99, gateSimilarity: 0.2, model, inferenceMs: 5 }
        : {
            isChestXray: true, label: 'Tuberculosis', labelKey: 'TUBERCULOSIS', confidence: 91.2, gatePassed: true,
            probabilities: { Normal: 6, Pneumonia: 3, Tuberculosis: 91 },
            assessment: { band: 'DISEASE', text: 'Tuberculosis pattern detected.', diseaseProbability: 94, heatmapFor: 'Tuberculosis' },
            regions: [{ label: 'TB-pattern opacity', score: 0.91, x: 20, y: 15, w: 25, h: 20 }],
            heatmapPng: png.toString('base64'), previewPng: null, imageSize: [1, 1], notCxrProbability: 0.1, gateSimilarity: 0.9,
            risk: { riskScore: 0.71, riskBand: 'HIGH', condition: 'TUBERCULOSIS', horizonMonths: 12, followUp: 'Sputum test now.',
                    topFactors: [{ factor: 'X-ray findings', weight: 0.68 }], clinicalProvided: /name="clinical"/.test(body), method: 'rule-based' },
            model, inferenceMs: 5,
          };
      res.writeHead(200, { 'Content-Type': 'application/json' }).end(JSON.stringify(out));
    });
  });
  return new Promise((r) => server.listen(0, '127.0.0.1', () => r(server)));
}

describe('7.4 Smart Diagnosis Center - upload, AI analysis, report', () => {
  let ctx: Awaited<ReturnType<typeof boot>>;
  let ai: Server;
  beforeAll(async () => {
    ai = await fakeAiService();
    process.env.AI_SERVICE_URL = `http://127.0.0.1:${(ai.address() as AddressInfo).port}`;
    process.env.AI_INTERNAL_KEY = 'test-internal-key';
    ctx = await boot();
  });
  afterAll(async () => { await ctx.app.close(); ai.close(); });

  it('TC-55 rejects files that are not really images (magic-byte check)', async () => {
    const d = await signIn(ctx.http, 'a.rehman@predictdx.com', 'DOCTOR');
    const patients = await request(ctx.http).get(`${API}/workspace/patients`).set(auth(d)).expect(200);
    await request(ctx.http)
      .post(`${API}/diagnosis/studies`)
      .set(auth(d))
      .field('patientId', patients.body[0].id)
      .attach('file', Buffer.from('MZ-this-is-an-exe'), { filename: 'xray.png', contentType: 'image/png' })
      .expect(400);
  });

  it('TC-56 upload -> analyse streams pipeline steps, calls the AI service and stores the result + heatmap', async () => {
    const d = await signIn(ctx.http, 'a.rehman@predictdx.com', 'DOCTOR');
    const patients = await request(ctx.http).get(`${API}/workspace/patients`).set(auth(d)).expect(200);
    const up = await request(ctx.http)
      .post(`${API}/diagnosis/studies`)
      .set(auth(d))
      .field('patientId', patients.body[0].id)
      .attach('file', readFileSync(resolve(__dirname, '../prisma/demo-xray.jpg')), { filename: 'chest.jpg', contentType: 'image/jpeg' })
      .expect(201);
    const sock = await connect(ctx.base, d.token);
    const firstStep = nextEvent(sock, 'study:progress', (p: any) => p.id === up.body.id);
    const done = nextEvent(sock, 'study:done', (p: any) => p.id === up.body.id, 15000);
    await request(ctx.http).post(`${API}/diagnosis/studies/${up.body.id}/analyse`).set(auth(d))
      .send({ clinical: { age: 45, coughDays: 21, nightSweats: true, tbContact: true } }).expect(202);
    expect((await firstStep).steps).toHaveLength(5);
    const r = (await done).result;
    expect(r.isChestXray).toBe(true);
    const total = Object.values(r.probabilities as Record<string, number>).reduce((a, b) => a + b, 0);
    expect(total).toBe(100);
    expect(['NORMAL', 'SUSPICIOUS', 'DISEASE']).toContain(r.assessment.band);
    expect(['Low', 'Medium', 'High']).toContain(r.risk.band);
    expect(r.risk.clinicalProvided).toBe(true);
    expect(r.clinical.coughDays).toBe(21);
    const img = await request(ctx.http).get(`${API}/diagnosis/studies/${up.body.id}/image`).set(auth(d)).expect(200);
    expect(img.headers['content-type']).toBe('image/jpeg');
    const heat = await request(ctx.http).get(`${API}/diagnosis/studies/${up.body.id}/heatmap`).set(auth(d)).expect(200);
    expect(heat.headers['content-type']).toBe('image/png');
    sock.disconnect();
  });

  it('TC-56b a photo that is not a chest X-ray is rejected, never diagnosed, and cannot be reported', async () => {
    const d = await signIn(ctx.http, 'a.rehman@predictdx.com', 'DOCTOR');
    const patients = await request(ctx.http).get(`${API}/workspace/patients`).set(auth(d)).expect(200);
    const up = await request(ctx.http)
      .post(`${API}/diagnosis/studies`).set(auth(d))
      .field('patientId', patients.body[0].id)
      .attach('file', readFileSync(resolve(__dirname, '../prisma/demo-xray.jpg')), { filename: 'cat.jpg', contentType: 'image/jpeg' })
      .expect(201);
    const sock = await connect(ctx.base, d.token);
    const rejected = nextEvent(sock, 'study:rejected', (p: any) => p.id === up.body.id, 15000);
    await request(ctx.http).post(`${API}/diagnosis/studies/${up.body.id}/analyse`).set(auth(d)).send({}).expect(202);
    expect((await rejected).reason).toMatch(/not a chest X-ray/);
    const list = await request(ctx.http).get(`${API}/diagnosis/studies`).set(auth(d)).expect(200);
    expect(list.body.find((s: any) => s.id === up.body.id).status).toBe('REJECTED');
    await request(ctx.http).post(`${API}/diagnosis/studies/${up.body.id}/report`).set(auth(d)).send({}).expect(409);
    sock.disconnect();
  });

  it('TC-56c invalid symptom values are refused before reaching the AI service', async () => {
    const d = await signIn(ctx.http, 'a.rehman@predictdx.com', 'DOCTOR');
    const list = await request(ctx.http).get(`${API}/diagnosis/studies`).set(auth(d)).expect(200);
    await request(ctx.http).post(`${API}/diagnosis/studies/${list.body[0].id}/analyse`).set(auth(d))
      .send({ clinical: { age: 400 } }).expect(400);
  });

  it('TC-58 a doctor files the AI report into the patient record (once) and the patient is notified', async () => {
    const d = await signIn(ctx.http, 'a.rehman@predictdx.com', 'DOCTOR');
    const studies = await request(ctx.http).get(`${API}/diagnosis/studies`).set(auth(d)).expect(200);
    const done = studies.body.find((s: any) => s.status === 'ANALYSED');
    const fresh = studies.body.find((s: any) => s.status === 'UPLOADED');
    if (fresh) await request(ctx.http).post(`${API}/diagnosis/studies/${fresh.id}/report`).set(auth(d)).send({}).expect(409); // not analysed yet
    const r = await request(ctx.http).post(`${API}/diagnosis/studies/${done.id}/report`).set(auth(d)).send({ acceptedFindings: 1 }).expect(200);
    expect(r.body.message).toMatch(/Report filed/);
    await request(ctx.http).post(`${API}/diagnosis/studies/${done.id}/report`).set(auth(d)).send({}).expect(409);
    const p = await signIn(ctx.http, 'ayesha.khan@predictdx.com', 'PATIENT');
    const owner = done.patient.name === 'Ayesha Khan' ? p : null;
    if (owner) {
      const recs = await request(ctx.http).get(`${API}/records`).set(auth(owner)).expect(200);
      expect(recs.body.some((x: any) => x.title === `AI chest X-ray analysis · ${done.code}`)).toBe(true);
    }
  });

  it('TC-59 referring a study notifies the radiologists', async () => {
    const d = await signIn(ctx.http, 'a.rehman@predictdx.com', 'DOCTOR');
    const studies = await request(ctx.http).get(`${API}/diagnosis/studies`).set(auth(d)).expect(200);
    const done = studies.body.find((s: any) => s.status === 'ANALYSED');
    const radiologist = await signIn(ctx.http, 's.malik@predictdx.com', 'DOCTOR');
    const sock = await connect(ctx.base, radiologist.token);
    const notified = nextEvent(sock, 'notification', (n: any) => n.type === 'study.referred');
    const r = await request(ctx.http).post(`${API}/diagnosis/studies/${done.id}/refer`).set(auth(d)).send({}).expect(200);
    expect(r.body.message).toMatch(/Dr Sana Malik/);
    expect((await notified).body).toMatch(done.code);
    sock.disconnect();
  });

  it('TC-63 X-rays are stored in PostgreSQL; the confirmed diagnosis becomes a training label', async () => {
    const d = await signIn(ctx.http, 'a.rehman@predictdx.com', 'DOCTOR');
    const patients = await request(ctx.http).get(`${API}/workspace/patients`).set(auth(d)).expect(200);
    const up = await request(ctx.http)
      .post(`${API}/diagnosis/studies`).set(auth(d))
      .field('patientId', patients.body[0].id)
      .attach('file', readFileSync(resolve(__dirname, '../prisma/demo-xray.jpg')), { filename: 'label-me.jpg', contentType: 'image/jpeg' })
      .expect(201);
    const before = await request(ctx.http).get(`${API}/diagnosis/dataset`).set(auth(d)).expect(200);
    await request(ctx.http).patch(`${API}/diagnosis/studies/${up.body.id}/label`).set(auth(d)).send({ label: 'CANCER' }).expect(400);
    const l = await request(ctx.http).patch(`${API}/diagnosis/studies/${up.body.id}/label`).set(auth(d)).send({ label: 'TUBERCULOSIS' }).expect(200);
    expect(l.body.verifiedLabel).toBe('TUBERCULOSIS');
    const after = await request(ctx.http).get(`${API}/diagnosis/dataset`).set(auth(d)).expect(200);
    expect(after.body.counts.TUBERCULOSIS ?? 0).toBe((before.body.counts.TUBERCULOSIS ?? 0) + 1);
    const img = await request(ctx.http).get(`${API}/diagnosis/studies/${up.body.id}/image`).set(auth(d)).expect(200);
    expect(img.body.length).toBe(readFileSync(resolve(__dirname, '../prisma/demo-xray.jpg')).length);
    const p = await signIn(ctx.http, 'ayesha.khan@predictdx.com', 'PATIENT');
    await request(ctx.http).patch(`${API}/diagnosis/studies/${up.body.id}/label`).set(auth(p)).send({ label: 'NORMAL' }).expect(403);
  });

  it('TC-57 training status is readable by doctors, not by patients', async () => {
    const d = await signIn(ctx.http, 'a.rehman@predictdx.com', 'DOCTOR');
    const t = await request(ctx.http).get(`${API}/diagnosis/training`).set(auth(d)).expect(200);
    expect(['in progress', 'trained']).toContain(t.body.status);
    const p = await signIn(ctx.http, 'ayesha.khan@predictdx.com', 'PATIENT');
    await request(ctx.http).get(`${API}/diagnosis/training`).set(auth(p)).expect(403);
  });
});
