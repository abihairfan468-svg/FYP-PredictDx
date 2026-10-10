import request from 'supertest';
import { io } from 'socket.io-client';
import { API, auth, bookAndPay, boot, connect, newPatient, nextEvent, signIn } from './helpers';

describe('7.6 CareConnect Hub - real-time messaging, CareBot, notifications', () => {
  let ctx: Awaited<ReturnType<typeof boot>>;
  beforeAll(async () => (ctx = await boot()));
  afterAll(async () => ctx.app.close());

  async function pair(name = 'Chat Patient') {
    const patient = await newPatient(ctx.http, name);
    const doctor = await signIn(ctx.http, 'a.faheem@predictdx.com', 'DOCTOR');
    await bookAndPay(ctx.http, patient, doctor.user.doctor.id);
    return { patient, doctor };
  }

  it('TC-47 sockets refuse to connect without a valid token', async () => {
    const s = io(ctx.base, { auth: { token: 'nope' }, transports: ['websocket'], reconnection: false });
    const err = await nextEvent(s, 'auth_error');
    expect(err.message).toMatch(/expired/);
    s.disconnect();
  });

  it('TC-48 messaging needs a care relationship', async () => {
    const stranger = await newPatient(ctx.http);
    const doctor = await signIn(ctx.http, 'h.khalid@predictdx.com', 'DOCTOR');
    await request(ctx.http).post(`${API}/chat/threads`).set(auth(stranger)).send({ userId: doctor.user.id }).expect(403);
    const contacts = await request(ctx.http).get(`${API}/chat/contacts`).set(auth(stranger)).expect(200);
    expect(contacts.body).toEqual([]);
  });

  it('TC-49 messages arrive in real time with typing indicators and read receipts', async () => {
    const { patient, doctor } = await pair('Realtime Patient');
    const contacts = await request(ctx.http).get(`${API}/chat/contacts`).set(auth(patient)).expect(200);
    expect(contacts.body.map((c: any) => c.userId)).toContain(doctor.user.id);

    const thread = await request(ctx.http).post(`${API}/chat/threads`).set(auth(patient)).send({ userId: doctor.user.id }).expect(201);
    const same = await request(ctx.http).post(`${API}/chat/threads`).set(auth(doctor)).send({ userId: patient.user.id }).expect(201);
    expect(same.body.id).toBe(thread.body.id); // one thread per pair

    const ps = await connect(ctx.base, patient.token);
    const ds = await connect(ctx.base, doctor.token);

    const typing = nextEvent(ds, 'typing', (t: any) => t.threadId === thread.body.id && t.typing);
    ps.emit('typing', { threadId: thread.body.id, typing: true });
    expect((await typing).name).toBe('Realtime Patient');

    const received = nextEvent(ds, 'message:new', (m: any) => m.threadId === thread.body.id);
    await request(ctx.http).post(`${API}/chat/threads/${thread.body.id}/messages`).set(auth(patient)).send({ body: '  Is my X-ray back?  ' }).expect(201);
    expect((await received).message.body).toBe('Is my X-ray back?');

    const list = await request(ctx.http).get(`${API}/chat/threads`).set(auth(doctor)).expect(200);
    expect(list.body.find((t: any) => t.id === thread.body.id).unread).toBe(1);

    const receipt = nextEvent(ps, 'thread:read', (r: any) => r.threadId === thread.body.id);
    await request(ctx.http).post(`${API}/chat/threads/${thread.body.id}/read`).set(auth(doctor)).expect(200);
    expect((await receipt).userId).toBe(doctor.user.id);

    const reply = nextEvent(ps, 'message:new', (m: any) => m.message.senderId === doctor.user.id);
    await request(ctx.http).post(`${API}/chat/threads/${thread.body.id}/messages`).set(auth(doctor)).send({ body: 'Yes, all clear.' }).expect(201);
    expect((await reply).message.body).toBe('Yes, all clear.');

    const history = await request(ctx.http).get(`${API}/chat/threads/${thread.body.id}/messages`).set(auth(patient)).expect(200);
    expect(history.body.map((m: any) => m.body)).toEqual(['Is my X-ray back?', 'Yes, all clear.']);
    ps.disconnect();
    ds.disconnect();
  });

  it('TC-50 outsiders cannot read or post in a thread, and empty messages are refused', async () => {
    const { patient, doctor } = await pair();
    const thread = await request(ctx.http).post(`${API}/chat/threads`).set(auth(patient)).send({ userId: doctor.user.id }).expect(201);
    const outsider = await newPatient(ctx.http);
    await request(ctx.http).get(`${API}/chat/threads/${thread.body.id}/messages`).set(auth(outsider)).expect(404);
    await request(ctx.http).post(`${API}/chat/threads/${thread.body.id}/messages`).set(auth(outsider)).send({ body: 'hi' }).expect(404);
    await request(ctx.http).post(`${API}/chat/threads/${thread.body.id}/messages`).set(auth(patient)).send({ body: '   ' }).expect(400);
    await request(ctx.http).post(`${API}/chat/threads/${thread.body.id}/messages`).set(auth(patient)).send({ body: 'x'.repeat(2001) }).expect(400);
  });

  it('TC-51 offline recipients get a stored notification instead', async () => {
    const { patient, doctor } = await pair();
    const thread = await request(ctx.http).post(`${API}/chat/threads`).set(auth(doctor)).send({ userId: patient.user.id }).expect(201);
    await request(ctx.http).post(`${API}/chat/threads/${thread.body.id}/messages`).set(auth(doctor)).send({ body: 'Please bring your old films.' }).expect(201);
    const n = await request(ctx.http).get(`${API}/notifications`).set(auth(patient)).expect(200);
    expect(n.body.some((x: any) => x.type === 'chat.message' && /old films/.test(x.body))).toBe(true);
    await request(ctx.http).post(`${API}/notifications/read-all`).set(auth(patient)).expect(201);
    const after = await request(ctx.http).get(`${API}/notifications`).set(auth(patient)).expect(200);
    expect(after.body.every((x: any) => x.readAt)).toBe(true);
  });

  it('TC-52 CareBot answers from the patient\'s real data', async () => {
    const { patient } = await pair('Bot Patient');
    const threads = await request(ctx.http).get(`${API}/chat/threads`).set(auth(patient)).expect(200);
    const bot = threads.body.find((t: any) => t.kind === 'BOT');
    expect(bot.other.name).toBe('CareBot assistant');
    const sock = await connect(ctx.base, patient.token);
    const answer = nextEvent(sock, 'message:new', (m: any) => m.threadId === bot.id && m.message.isBot);
    await request(ctx.http).post(`${API}/chat/threads/${bot.id}/messages`).set(auth(patient)).send({ body: 'When is my next appointment?' }).expect(201);
    expect((await answer).message.body).toMatch(/Dr Ali Faheem/);
    sock.disconnect();
  });

  it('TC-53 CareBot never gives clinical advice - it forwards to the doctor', async () => {
    const { patient, doctor } = await pair('Escalation Patient');
    const threads = await request(ctx.http).get(`${API}/chat/threads`).set(auth(patient)).expect(200);
    const bot = threads.body.find((t: any) => t.kind === 'BOT');
    const ds = await connect(ctx.base, doctor.token);
    const forwarded = nextEvent(ds, 'message:new', (m: any) => /Forwarded by CareBot/.test(m.message.body));
    await request(ctx.http).post(`${API}/chat/threads/${bot.id}/messages`).set(auth(patient)).send({ body: 'Can I double my dose of rifampicin?' }).expect(201);
    expect((await forwarded).message.body).toMatch(/double my dose/);
    const msgs = await request(ctx.http).get(`${API}/chat/threads/${bot.id}/messages`).set(auth(patient)).expect(200);
    expect(msgs.body.at(-1).body).toMatch(/needs your doctor/);
    ds.disconnect();
  });

  it('TC-54 emergency phrases get emergency guidance immediately', async () => {
    const { patient } = await pair();
    const threads = await request(ctx.http).get(`${API}/chat/threads`).set(auth(patient)).expect(200);
    const bot = threads.body.find((t: any) => t.kind === 'BOT');
    const sock = await connect(ctx.base, patient.token);
    const answer = nextEvent(sock, 'message:new', (m: any) => m.threadId === bot.id && m.message.isBot);
    await request(ctx.http).post(`${API}/chat/threads/${bot.id}/messages`).set(auth(patient)).send({ body: 'I am coughing up blood' }).expect(201);
    expect((await answer).message.body).toMatch(/1122/);
    sock.disconnect();
  });
});
