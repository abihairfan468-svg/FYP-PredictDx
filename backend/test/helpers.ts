import { Test } from '@nestjs/testing';
import { NestExpressApplication } from '@nestjs/platform-express';
import request from 'supertest';
import { io, Socket } from 'socket.io-client';
import { AppModule } from '../src/app.module';
import { configureApp } from '../src/main';
import { PASSWORDS } from '../prisma/data/accounts';

/** Password used for accounts the tests register themselves. */
export const PASSWORD = 'Predictdx@2026';
/** Password of a seeded account (each has its own), or of a test-registered one. */
export const pw = (email: string) => PASSWORDS[email] ?? PASSWORD;
export const API = '/api/v1';

export async function boot() {
  const mod = await Test.createTestingModule({ imports: [AppModule] }).compile();
  const app = mod.createNestApplication<NestExpressApplication>({ logger: false });
  configureApp(app);
  await app.listen(0);
  const port = (app.getHttpServer().address() as { port: number }).port;
  return { app, http: app.getHttpServer(), base: `http://127.0.0.1:${port}` };
}

export interface Session {
  token: string;
  cookie: string;
  user: any;
}

const cookieOf = (res: request.Response) =>
  ((res.headers['set-cookie'] as unknown as string[] | undefined) ?? []).map((c) => c.split(';')[0]).join('; ');

/** Password + e-mail OTP, the full two-step sign-in. */
export async function signIn(http: any, email: string, role: string, password = pw(email)): Promise<Session> {
  const first = await request(http).post(`${API}/auth/login`).send({ email, password, role });
  if (first.status !== 200) throw new Error(`login ${email}: ${first.status} ${JSON.stringify(first.body)}`);
  if (first.body.status === 'OK') return { token: first.body.accessToken, cookie: cookieOf(first), user: first.body.user };
  const second = await request(http).post(`${API}/auth/mfa/verify`).send({ mfaToken: first.body.mfaToken, code: first.body.devCode });
  if (second.status !== 200) throw new Error(`mfa ${email}: ${second.status} ${JSON.stringify(second.body)}`);
  return { token: second.body.accessToken, cookie: cookieOf(second), user: second.body.user };
}

let n = 0;
/** Registers and verifies a brand-new patient, returning a signed-in session. */
export async function newPatient(http: any, name = 'Test Patient'): Promise<Session & { email: string }> {
  const email = `patient${Date.now()}${++n}@test.pk`;
  const reg = await request(http)
    .post(`${API}/auth/register`)
    .send({ role: 'PATIENT', fullName: name, email, password: PASSWORD, gender: 'FEMALE', dateOfBirth: '1996-04-02', city: 'Islamabad' });
  if (reg.status !== 201) throw new Error(`register: ${JSON.stringify(reg.body)}`);
  const ver = await request(http).post(`${API}/auth/verify-email`).send({ email, code: reg.body.devCode });
  return { token: ver.body.accessToken, cookie: cookieOf(ver), user: ver.body.user, email };
}

export const auth = (s: Session) => ({ Authorization: `Bearer ${s.token}` });

export function connect(base: string, token: string): Promise<Socket> {
  return new Promise((resolve, reject) => {
    const s = io(base, { auth: { token }, transports: ['websocket'], reconnection: false });
    s.on('ready', () => resolve(s));
    s.on('connect_error', reject);
    s.on('auth_error', () => reject(new Error('socket auth failed')));
  });
}

export function nextEvent<T = any>(s: Socket, event: string, match: (p: T) => boolean = () => true, ms = 8000): Promise<T> {
  return new Promise((resolve, reject) => {
    const t = setTimeout(() => reject(new Error(`timeout waiting for ${event}`)), ms);
    const fn = (p: T) => {
      if (!match(p)) return;
      clearTimeout(t);
      s.off(event, fn);
      resolve(p);
    };
    s.on(event, fn);
  });
}

/** Books the first free slot with a doctor and pays for it. */
export async function bookAndPay(http: any, patient: Session, doctorId: string) {
  const slots = await request(http).get(`${API}/doctors/${doctorId}/slots`).set(auth(patient)).expect(200);
  const startAt = slots.body.slots[0].startAt;
  const held = await request(http).post(`${API}/appointments`).set(auth(patient)).send({ doctorId, startAt, reason: 'Cough' }).expect(201);
  const paid = await request(http).post(`${API}/appointments/${held.body.id}/pay`).set(auth(patient)).send({ method: 'JAZZCASH' }).expect(200);
  return paid.body;
}
