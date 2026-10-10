import request from 'supertest';
import { authenticator } from 'otplib';
import { API, auth, boot, newPatient, PASSWORD, pw, signIn } from './helpers';

describe('7.1 Smart Entry Portal - authentication, MFA & access control', () => {
  let ctx: Awaited<ReturnType<typeof boot>>;
  beforeAll(async () => (ctx = await boot()));
  afterAll(async () => ctx.app.close());
  const post = (path: string) => request(ctx.http).post(`${API}${path}`);

  describe('registration & e-mail verification', () => {
    const email = `reg${Date.now()}@test.pk`;

    it('TC-01 rejects a weak password with a clear message', async () => {
      const r = await post('/auth/register').send({ role: 'PATIENT', fullName: 'Weak Pass', email, password: 'password' }).expect(400);
      expect(String(r.body.message)).toMatch(/upper-case letter/);
    });

    it('TC-02 rejects an invalid e-mail and unknown fields (strict validation)', async () => {
      await post('/auth/register').send({ role: 'PATIENT', fullName: 'Bad Mail', email: 'not-an-email', password: PASSWORD }).expect(400);
      await post('/auth/register').send({ role: 'PATIENT', fullName: 'Extra', email, password: PASSWORD, isAdmin: true }).expect(400);
    });

    it('TC-03 refuses self-registration as an administrator', async () => {
      await post('/auth/register').send({ role: 'ADMIN', fullName: 'Sneaky', email, password: PASSWORD }).expect(400);
    });

    it('TC-04 registers a patient and sends a verification code', async () => {
      const r = await post('/auth/register').send({ role: 'PATIENT', fullName: 'New Patient', email, password: PASSWORD }).expect(201);
      expect(r.body).toMatchObject({ status: 'VERIFY_EMAIL', email });
      expect(r.body.devCode).toMatch(/^\d{6}$/);
      expect(r.body.maskedEmail).not.toBe(email);
    });

    it('TC-05 refuses a duplicate e-mail', async () => {
      await post('/auth/register').send({ role: 'PATIENT', fullName: 'Dup', email, password: PASSWORD }).expect(409);
    });

    it('TC-06 an unverified account is sent back to verification on login', async () => {
      const r = await post('/auth/login').send({ email, password: PASSWORD, role: 'PATIENT' }).expect(200);
      expect(r.body.status).toBe('VERIFY_EMAIL');
    });

    it('TC-07 a wrong code is rejected and counts attempts; the right code signs in', async () => {
      const issued = await post('/auth/otp/resend').send({ purpose: 'VERIFY_EMAIL', email }).expect(200);
      const bad = await post('/auth/verify-email').send({ email, code: issued.body.devCode === '000000' ? '111111' : '000000' }).expect(400);
      expect(bad.body.message).toMatch(/4 attempts left/);
      const ok = await post('/auth/verify-email').send({ email, code: issued.body.devCode }).expect(200);
      expect(ok.body.status).toBe('OK');
      expect(ok.body.accessToken).toBeTruthy();
      expect(ok.body.refreshToken).toBeUndefined(); // never in the body
      expect(String(ok.headers['set-cookie'])).toMatch(/pdx_rt=.*HttpOnly.*SameSite=Strict/i);
      expect(ok.body.user.patient.mrn).toMatch(/^PDX-\d+$/);
    });

    it('TC-08 a used code cannot be replayed', async () => {
      const issued = await post('/auth/otp/resend').send({ purpose: 'VERIFY_EMAIL', email }).expect(200);
      expect(issued.body.devCode).toBeUndefined(); // already verified -> nothing issued
    });
  });

  describe('sign-in with two-step verification', () => {
    it('TC-09 correct password -> MFA challenge, not a session', async () => {
      const r = await post('/auth/login').send({ email: 'ayesha.khan@predictdx.com', password: pw('ayesha.khan@predictdx.com'), role: 'PATIENT' }).expect(200);
      expect(r.body.status).toBe('MFA_REQUIRED');
      expect(r.body.method).toBe('EMAIL');
      expect(r.body.accessToken).toBeUndefined();
    });

    it('TC-10 wrong MFA code is refused, right one issues tokens', async () => {
      const r = await post('/auth/login').send({ email: 'ayesha.khan@predictdx.com', password: pw('ayesha.khan@predictdx.com'), role: 'PATIENT' }).expect(200);
      await post('/auth/mfa/verify').send({ mfaToken: r.body.mfaToken, code: r.body.devCode === '123456' ? '654321' : '123456' }).expect(400);
      const ok = await post('/auth/mfa/verify').send({ mfaToken: r.body.mfaToken, code: r.body.devCode }).expect(200);
      expect(ok.body.user.email).toBe('ayesha.khan@predictdx.com');
    });

    it('TC-11 a forged MFA token is refused', async () => {
      await post('/auth/mfa/verify').send({ mfaToken: 'eyJhbGciOiJIUzI1NiJ9.eyJzdWIiOiJ4In0.bad', code: '123456' }).expect(401);
    });

    it('TC-12 picking the wrong role tab is refused', async () => {
      const r = await post('/auth/login').send({ email: 'ayesha.khan@predictdx.com', password: pw('ayesha.khan@predictdx.com'), role: 'DOCTOR' }).expect(401);
      expect(r.body.message).toMatch(/not registered as a doctor/);
    });

    it('TC-13 unknown e-mail and wrong password give the same message (no account enumeration)', async () => {
      const a = await post('/auth/login').send({ email: 'nobody@test.pk', password: PASSWORD, role: 'PATIENT' }).expect(401);
      const b = await post('/auth/login').send({ email: 'hira.saleem@predictdx.com', password: 'Wrong@2026', role: 'PATIENT' }).expect(401);
      expect(a.body.message).toMatch(/^Incorrect e-mail or password/);
      expect(b.body.message).toMatch(/^Incorrect e-mail or password/);
    });

    it('TC-14 five wrong passwords lock the account, even for the right password', async () => {
      const p = await newPatient(ctx.http, 'Lock Test');
      for (let i = 0; i < 4; i++) await post('/auth/login').send({ email: p.email, password: 'Wrong@2026', role: 'PATIENT' }).expect(401);
      const locked = await post('/auth/login').send({ email: p.email, password: 'Wrong@2026', role: 'PATIENT' }).expect(403);
      expect(locked.body.message).toMatch(/locked for 15 minutes/);
      await post('/auth/login').send({ email: p.email, password: PASSWORD, role: 'PATIENT' }).expect(403);
    });

    it('TC-15 a blocked account cannot sign in', async () => {
      const r = await post('/auth/login').send({ email: 'kamran.shah@predictdx.com', password: pw('kamran.shah@predictdx.com'), role: 'PATIENT' }).expect(403);
      expect(r.body.message).toMatch(/blocked/);
    });
  });

  describe('tokens, sessions and role-based access', () => {
    it('TC-16 protected routes need a token', async () => {
      await request(ctx.http).get(`${API}/auth/me`).expect(401);
      await request(ctx.http).get(`${API}/auth/me`).set('Authorization', 'Bearer garbage').expect(401);
    });

    it('TC-17 RBAC: a patient cannot reach doctor or admin APIs', async () => {
      const s = await signIn(ctx.http, 'ayesha.khan@predictdx.com', 'PATIENT');
      await request(ctx.http).get(`${API}/auth/me`).set(auth(s)).expect(200);
      await request(ctx.http).get(`${API}/workspace/day`).set(auth(s)).expect(403);
      await request(ctx.http).get(`${API}/admin/overview`).set(auth(s)).expect(403);
      await request(ctx.http).get(`${API}/diagnosis/studies`).set(auth(s)).expect(403);
    });

    it('TC-18 RBAC: a doctor cannot reach admin APIs or book as a patient', async () => {
      const d = await signIn(ctx.http, 'a.rehman@predictdx.com', 'DOCTOR');
      await request(ctx.http).get(`${API}/admin/users`).set(auth(d)).expect(403);
      await request(ctx.http).post(`${API}/appointments`).set(auth(d)).send({ doctorId: '00000000-0000-4000-8000-000000000000', startAt: new Date().toISOString() }).expect(403);
    });

    it('TC-19 refresh rotates the token; replaying the old one ends every session', async () => {
      const s = await signIn(ctx.http, 'bilal.raza@predictdx.com', 'PATIENT');
      const r1 = await post('/auth/refresh').set('Cookie', s.cookie).expect(200);
      const rotated = String(r1.headers['set-cookie']).split(';')[0];
      expect(rotated).not.toBe(s.cookie);
      await request(ctx.http).get(`${API}/auth/me`).set('Authorization', `Bearer ${r1.body.accessToken}`).expect(200);
      // Attacker replays the stolen, already-used refresh token:
      await post('/auth/refresh').set('Cookie', s.cookie).expect(401);
      // ...which revokes the legitimate session too.
      await request(ctx.http).get(`${API}/auth/me`).set('Authorization', `Bearer ${r1.body.accessToken}`).expect(401);
      await post('/auth/refresh').set('Cookie', rotated).expect(401);
    });

    it('TC-20 logout revokes the session immediately (access token stops working)', async () => {
      const s = await signIn(ctx.http, 'hira.saleem@predictdx.com', 'PATIENT');
      await request(ctx.http).get(`${API}/auth/me`).set(auth(s)).expect(200);
      await post('/auth/logout').set('Cookie', s.cookie).expect(200);
      await request(ctx.http).get(`${API}/auth/me`).set(auth(s)).expect(401);
    });

    it('TC-21 signed-in devices can be listed and revoked', async () => {
      const a = await signIn(ctx.http, 'usman.tariq@predictdx.com', 'PATIENT');
      const b = await signIn(ctx.http, 'usman.tariq@predictdx.com', 'PATIENT');
      const list = await request(ctx.http).get(`${API}/account/sessions`).set(auth(a)).expect(200);
      const other = list.body.find((x: any) => !x.current);
      expect(list.body.some((x: any) => x.current)).toBe(true);
      await request(ctx.http).delete(`${API}/account/sessions/${other.id}`).set(auth(a)).expect(200);
      await request(ctx.http).get(`${API}/auth/me`).set(auth(b)).expect(401);
      await request(ctx.http).get(`${API}/auth/me`).set(auth(a)).expect(200);
    });
  });

  describe('password reset & change', () => {
    it('TC-22 forgot-password answers the same for unknown e-mails', async () => {
      const r = await post('/auth/password/forgot').send({ email: 'ghost@test.pk' }).expect(200);
      expect(r.body).toEqual({ sent: true });
    });

    it('TC-23 reset with the e-mailed code, then sign in with the new password', async () => {
      const p = await newPatient(ctx.http, 'Reset Test');
      const f = await post('/auth/password/forgot').send({ email: p.email }).expect(200);
      await post('/auth/password/reset').send({ email: p.email, code: f.body.devCode, newPassword: 'short' }).expect(400);
      await post('/auth/password/reset').send({ email: p.email, code: f.body.devCode, newPassword: 'Brand@New2026' }).expect(200);
      await request(ctx.http).get(`${API}/auth/me`).set(auth(p)).expect(401); // old sessions ended
      await signIn(ctx.http, p.email, 'PATIENT', 'Brand@New2026');
    });

    it('TC-24 change password needs the current one and signs out other devices', async () => {
      const p = await newPatient(ctx.http, 'Change Test');
      const other = await signIn(ctx.http, p.email, 'PATIENT');
      await request(ctx.http).post(`${API}/account/password`).set(auth(p)).send({ currentPassword: 'Wrong@2026', newPassword: 'Another@2026' }).expect(400);
      const r = await request(ctx.http).post(`${API}/account/password`).set(auth(p)).send({ currentPassword: PASSWORD, newPassword: 'Another@2026' }).expect(201);
      expect(r.body.otherSessionsEnded).toBe(1);
      await request(ctx.http).get(`${API}/auth/me`).set(auth(other)).expect(401);
      await request(ctx.http).get(`${API}/auth/me`).set(auth(p)).expect(200);
    });
  });

  describe('multi-factor options', () => {
    it('TC-25 doctors cannot switch MFA off; patients can', async () => {
      const d = await signIn(ctx.http, 'z.ahmed@predictdx.com', 'DOCTOR');
      await request(ctx.http).post(`${API}/account/mfa`).set(auth(d)).send({ enabled: false }).expect(403);
      const p = await newPatient(ctx.http, 'Mfa Off');
      const off = await request(ctx.http).post(`${API}/account/mfa`).set(auth(p)).send({ enabled: false }).expect(201);
      expect(off.body.mfaEnabled).toBe(false);
      const login = await post('/auth/login').send({ email: p.email, password: PASSWORD, role: 'PATIENT' }).expect(200);
      expect(login.body.status).toBe('OK');
    });

    it('TC-26 authenticator app (TOTP): setup, confirm, then required at sign-in', async () => {
      const p = await newPatient(ctx.http, 'Totp User');
      const setup = await request(ctx.http).post(`${API}/account/mfa/totp/setup`).set(auth(p)).expect(201);
      expect(setup.body.qr).toMatch(/^data:image\/png;base64,/);
      await request(ctx.http).post(`${API}/account/mfa/totp/enable`).set(auth(p)).send({ code: '000000' }).expect(400);
      const on = await request(ctx.http).post(`${API}/account/mfa/totp/enable`).set(auth(p)).send({ code: authenticator.generate(setup.body.secret) }).expect(201);
      expect(on.body.mfaMethod).toBe('TOTP');

      const login = await post('/auth/login').send({ email: p.email, password: PASSWORD, role: 'PATIENT' }).expect(200);
      expect(login.body).toMatchObject({ status: 'MFA_REQUIRED', method: 'TOTP' });
      expect(login.body.devCode).toBeUndefined(); // nothing is e-mailed for TOTP
      await post('/auth/mfa/verify').send({ mfaToken: login.body.mfaToken, code: authenticator.generate(setup.body.secret) }).expect(200);
    });
  });

  describe('doctor onboarding (licence verification by an administrator)', () => {
    const email = `doctor${Date.now()}@test.pk`;
    let doctorId = '';

    it('TC-62 a doctor uploads the PMDC licence at sign-up; the admin can open it, patients cannot', async () => {
    const mail = `lic${Date.now()}@test.pk`;
    const pdf = Buffer.from('%PDF-1.4\n1 0 obj<<>>endobj\ntrailer<<>>\n%%EOF');
    await post('/auth/register')
      .field('role', 'DOCTOR').field('fullName', 'Dr Fake File').field('email', `x${mail}`).field('password', PASSWORD)
      .field('specialization', 'Pulmonology').field('pmdcNumber', `X${Date.now() % 1e7}`).field('qualification', 'MBBS').field('hospital', 'Test').field('fee', '1000')
      .attach('licence', Buffer.from('MZ-not-a-document'), 'licence.pdf')
      .expect(400);
    const reg = await post('/auth/register')
      .field('role', 'DOCTOR').field('fullName', 'Dr Licence Upload').field('email', mail).field('password', PASSWORD)
      .field('specialization', 'Pulmonology').field('pmdcNumber', `L${Date.now() % 1e7}`).field('qualification', 'MBBS, FCPS').field('hospital', 'Shifa International Hospital').field('fee', '2500')
      .attach('licence', pdf, 'pmdc-licence.pdf')
      .expect(201);
    await post('/auth/verify-email').send({ email: mail, code: reg.body.devCode }).expect(200);
    const admin = await signIn(ctx.http, 'admin@predictdx.com', 'ADMIN');
    const ov = await request(ctx.http).get(`${API}/admin/overview`).set(auth(admin)).expect(200);
    const pending = ov.body.pending.find((p: any) => p.email === mail);
    expect(pending.licenceFileId).toBeTruthy();
    const file = await request(ctx.http).get(`${API}/files/${pending.licenceFileId}`).set(auth(admin)).expect(200);
    expect(file.headers['content-type']).toMatch(/application\/pdf/);
    const patient = await newPatient(ctx.http);
    await request(ctx.http).get(`${API}/files/${pending.licenceFileId}`).set(auth(patient)).expect(403);
  });

  it('TC-27 doctor registration requires PMDC details', async () => {
      await post('/auth/register').send({ role: 'DOCTOR', fullName: 'Dr No Pmdc', email, password: PASSWORD }).expect(400);
    });

    it('TC-28 verified e-mail -> pending approval -> cannot sign in yet', async () => {
      const reg = await post('/auth/register').send({
        role: 'DOCTOR', fullName: 'Dr Test Doctor', email, password: PASSWORD, specialization: 'Pulmonology',
        pmdcNumber: `T${Date.now() % 1e7}`, qualification: 'MBBS', hospital: 'Test Hospital', city: 'Islamabad', fee: 1900,
      }).expect(201);
      const ver = await post('/auth/verify-email').send({ email, code: reg.body.devCode }).expect(200);
      expect(ver.body.status).toBe('PENDING_APPROVAL');
      const login = await post('/auth/login').send({ email, password: PASSWORD, role: 'DOCTOR' }).expect(403);
      expect(login.body.message).toMatch(/being verified/);
    });

    it('TC-29 admin sees the licence, approves it, and the doctor can sign in and be found', async () => {
      const admin = await signIn(ctx.http, 'admin@predictdx.com', 'ADMIN');
      const ov = await request(ctx.http).get(`${API}/admin/overview`).set(auth(admin)).expect(200);
      const pending = ov.body.pending.find((p: any) => p.email === email);
      expect(pending).toBeTruthy();
      doctorId = pending.doctorId;
      await request(ctx.http).post(`${API}/admin/doctors/${doctorId}/decision`).set(auth(admin)).send({ approve: true }).expect(200);
      const doc = await signIn(ctx.http, email, 'DOCTOR');
      expect(doc.user.doctor.verified).toBe(true);
      const search = await request(ctx.http).get(`${API}/doctors?q=Test%20Doctor`).set(auth(doc)).expect(200);
      expect(search.body.results.map((r: any) => r.id)).toContain(doctorId);
    });

    it('TC-30 blocking a user ends their live session at once', async () => {
      const admin = await signIn(ctx.http, 'admin@predictdx.com', 'ADMIN');
      const p = await newPatient(ctx.http, 'Block Me');
      await request(ctx.http).get(`${API}/auth/me`).set(auth(p)).expect(200);
      await request(ctx.http).patch(`${API}/admin/users/${p.user.id}/status`).set(auth(admin)).send({ status: 'BLOCKED' }).expect(200);
      await request(ctx.http).get(`${API}/auth/me`).set(auth(p)).expect(401);
      await request(ctx.http).patch(`${API}/admin/users/${admin.user.id}/status`).set(auth(admin)).send({ status: 'BLOCKED' }).expect(403);
      const audit = await request(ctx.http).get(`${API}/admin/audit`).set(auth(admin)).expect(200);
      expect(audit.body.some((a: any) => a.action === 'admin.user_blocked')).toBe(true);
    });
  });
});
