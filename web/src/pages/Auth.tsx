import { FormEvent, useEffect, useRef, useState } from 'react';
import { Link, Navigate, useLocation, useNavigate } from 'react-router-dom';
import { Button, Input } from '../components';
import { api, ApiError, SessionResult } from '../lib/api';
import { HOME, useAuth } from '../lib/auth';
import { Icon, Mark, ThemeToggle, useDevCode, useToast } from '../lib/ui';
import './auth.css';

type Role = 'PATIENT' | 'DOCTOR' | 'ADMIN';
type Step = 'signin' | 'signup' | 'verify' | 'mfa' | 'forgot' | 'reset' | 'pending';

const ROLES: [Role, string, string, string][] = [
  ['PATIENT', 'Patient', 'Book visits, read reports', 'user'],
  ['DOCTOR', 'Doctor', 'Consult, diagnose, prescribe', 'stet'],
  ['ADMIN', 'Admin', 'Run the platform', 'shield'],
];
const SPECIALITIES = ['Pulmonology', 'Chest Specialist', 'General Physician', 'Radiology', 'Internal Medicine', 'Paediatrics'];
const RULES: [RegExp, string][] = [
  [/.{8,}/, '8+ characters'],
  [/[A-Z]/, 'upper-case'],
  [/[a-z]/, 'lower-case'],
  [/\d/, 'number'],
  [/[^A-Za-z0-9]/, 'symbol'],
];

type LoginResult =
  | SessionResult
  | { status: 'VERIFY_EMAIL'; email: string; maskedEmail: string; devCode?: string }
  | { status: 'MFA_REQUIRED'; mfaToken: string; method: 'EMAIL' | 'TOTP'; maskedEmail: string; devCode?: string }
  | { status: 'PENDING_APPROVAL' };

export default function Auth() {
  const { user, signIn } = useAuth();
  const nav = useNavigate();
  const loc = useLocation();
  const toast = useToast();
  const showCode = useDevCode();

  const wantsSignup = loc.hash === '#signup' || new URLSearchParams(loc.search).has('signup');
  const [step, setStep] = useState<Step>(wantsSignup ? 'signup' : 'signin');
  const [role, setRole] = useState<Role>('PATIENT');
  const [busy, setBusy] = useState(false);
  const [err, setErr] = useState<string | null>(null);
  const [fieldErr, setFieldErr] = useState<Record<string, string>>({});

  // shared form state
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [f, setF] = useState({ fullName: '', phone: '', dateOfBirth: '', gender: 'FEMALE', city: 'Islamabad', confirm: '', agree: false, specialization: 'Pulmonology', pmdcNumber: '', qualification: '', hospital: '', fee: '2000' });
  const set = (k: keyof typeof f, v: string | boolean) => setF((p) => ({ ...p, [k]: v }));

  // OTP state
  const [masked, setMasked] = useState('');
  const [mfaToken, setMfaToken] = useState('');
  const [mfaMethod, setMfaMethod] = useState<'EMAIL' | 'TOTP'>('EMAIL');
  const [cooldown, setCooldown] = useState(0);
  const [newPw, setNewPw] = useState('');
  const [licence, setLicence] = useState<File | null>(null);

  useEffect(() => {
    if (cooldown <= 0) return;
    const t = setTimeout(() => setCooldown((c) => c - 1), 1000);
    return () => clearTimeout(t);
  }, [cooldown]);

  if (user) return <Navigate to={HOME[user.role]} replace />;

  const go = (s: Step) => {
    setErr(null);
    setFieldErr({});
    setStep(s);
  };
  const toSignup = () => { go('signup'); if (role === 'ADMIN') setRole('PATIENT'); };

  // Landing page buttons can be clicked again while this page is open.
  useEffect(() => { setStep(wantsSignup ? 'signup' : 'signin'); }, [wantsSignup]);

  const finish = (r: LoginResult) => {
    if (r.status === 'OK') {
      signIn(r);
      toast(`Welcome, ${r.user.fullName.split(' ')[0]}`);
      nav(HOME[r.user.role], { replace: true });
    } else if (r.status === 'VERIFY_EMAIL') {
      setMasked(r.maskedEmail);
      setEmail(r.email);
      setCooldown(30);
      showCode(r.devCode);
      go('verify');
    } else if (r.status === 'MFA_REQUIRED') {
      setMasked(r.maskedEmail);
      setMfaToken(r.mfaToken);
      setMfaMethod(r.method);
      setCooldown(30);
      showCode(r.devCode);
      go('mfa');
    } else if (r.status === 'PENDING_APPROVAL') {
      go('pending');
    }
  };

  const run = async (fn: () => Promise<void>) => {
    setBusy(true);
    setErr(null);
    try {
      await fn();
    } catch (e) {
      setErr(e instanceof ApiError ? e.message : 'Something went wrong');
    } finally {
      setBusy(false);
    }
  };

  const onSignIn = (e: FormEvent) => {
    e.preventDefault();
    const fe: Record<string, string> = {};
    if (!/^\S+@\S+\.\S+$/.test(email)) fe.email = 'Enter a valid e-mail address';
    if (!password) fe.password = 'Enter your password';
    setFieldErr(fe);
    if (Object.keys(fe).length) return;
    run(async () => finish(await api<LoginResult>('/auth/login', { body: { email, password, role } })));
  };

  const onSignUp = (e: FormEvent) => {
    e.preventDefault();
    const fe: Record<string, string> = {};
    if (f.fullName.trim().length < 3) fe.fullName = 'Enter your full name';
    if (!/^\S+@\S+\.\S+$/.test(email)) fe.email = 'Enter a valid e-mail address';
    if (f.phone && !/^\+?[0-9 -]{10,16}$/.test(f.phone)) fe.phone = 'e.g. +92 300 1234567';
    if (!RULES.every(([r]) => r.test(password))) fe.password = 'Password does not meet every rule below';
    if (password !== f.confirm) fe.confirm = 'Passwords do not match';
    if (role === 'DOCTOR') {
      if (!/^[0-9A-Za-z-]{4,12}$/.test(f.pmdcNumber)) fe.pmdcNumber = 'Enter your PMDC number';
      if (!f.qualification.trim()) fe.qualification = 'Required';
      if (!f.hospital.trim()) fe.hospital = 'Required';
      if (!licence) fe.licence = 'Upload your PMDC licence';
      else if (licence.size > 5 * 1024 * 1024) fe.licence = 'The file must be under 5 MB';
    }
    if (!f.agree) fe.agree = 'Please accept to continue';
    setFieldErr(fe);
    if (Object.keys(fe).length) return;
    const body: Record<string, unknown> = { role, fullName: f.fullName, email, password, city: f.city };
    if (f.phone) body.phone = f.phone;
    if (role === 'PATIENT') Object.assign(body, { gender: f.gender, ...(f.dateOfBirth ? { dateOfBirth: f.dateOfBirth } : {}) });
    else Object.assign(body, { specialization: f.specialization, pmdcNumber: f.pmdcNumber, qualification: f.qualification, hospital: f.hospital, fee: Number(f.fee) || 0 });
    run(async () => {
      if (role === 'DOCTOR' && licence) {
        // Doctors send their licence file too, so the request is multipart.
        const form = new FormData();
        Object.entries(body).forEach(([k, v]) => form.append(k, String(v)));
        form.append('licence', licence);
        finish(await api<LoginResult>('/auth/register', { form }));
      } else finish(await api<LoginResult>('/auth/register', { body }));
    });
  };

  const verifyCode = (code: string) =>
    run(async () => {
      if (step === 'verify') finish(await api<LoginResult>('/auth/verify-email', { body: { email, code } }));
      else finish(await api<LoginResult>('/auth/mfa/verify', { body: { mfaToken, code } }));
    });

  const resend = () =>
    run(async () => {
      const r = await api<{ devCode?: string }>('/auth/otp/resend', {
        body: step === 'verify' ? { purpose: 'VERIFY_EMAIL', email } : step === 'mfa' ? { purpose: 'LOGIN_MFA', mfaToken } : { purpose: 'RESET_PASSWORD', email },
      });
      setCooldown(30);
      toast('A new code is on its way');
      showCode(r.devCode);
    });

  const onForgot = (e: FormEvent) => {
    e.preventDefault();
    if (!/^\S+@\S+\.\S+$/.test(email)) return setFieldErr({ email: 'Enter a valid e-mail address' });
    run(async () => {
      const r = await api<{ devCode?: string }>('/auth/password/forgot', { body: { email } });
      setCooldown(30);
      showCode(r.devCode);
      go('reset');
    });
  };

  const onReset = (code: string) => {
    if (!RULES.every(([r]) => r.test(newPw))) return setFieldErr({ newPw: 'Password does not meet every rule' });
    run(async () => {
      await api('/auth/password/reset', { body: { email, code, newPassword: newPw } });
      toast('Password changed. Sign in with your new password.');
      setPassword('');
      go('signin');
    });
  };

  return (
    <div className="au">
      <div className="au-top">
        {/* ---------------- image 1: navy lungs panel ---------------- */}
        <Link to="/" className="au-art" aria-label="PredictDx home">
          <img src="/img/lungs-square.jpg" alt="" />
          <div className="au-art-copy">
            <Mark s={62} color="#fff" />
            <div className="au-word">PredictDX</div>
            <p>AI multimodal system for early detection and future risk prediction of chest diseases.</p>
          </div>
        </Link>

        {/* ---------------- right: forms ---------------- */}
        <div className="au-right">
          <div className="au-card">
            <div className="between">
              <div className="eyebrow" style={{ color: 'var(--brand)' }}>Welcome to PredictDx</div>
              <ThemeToggle />
            </div>

            {(step === 'signin' || step === 'signup') && (
              <>
                <h2 className="au-h" style={{ marginTop: 16 }}>{step === 'signin' ? 'Sign in' : 'Create account'}</h2>
                <div className="eyebrow" style={{ margin: '16px 0 8px' }}>I am a</div>
                <div className="au-roles">
                  {ROLES.map(([k, t, d, i]) => {
                    const disabled = step === 'signup' && k === 'ADMIN';
                    return (
                      <button key={k} type="button" className={`au-role${role === k ? ' on' : ''}`} onClick={() => !disabled && setRole(k)} aria-pressed={role === k} disabled={disabled} title={disabled ? 'Administrator accounts are created by the hospital' : undefined}>
                        <Icon n={i} s={19} />
                        <b>{t}</b>
                        <small>{disabled ? 'Created by the hospital' : d}</small>
                      </button>
                    );
                  })}
                </div>
              </>
            )}

            {err && <div className="notice crit" style={{ marginTop: 14 }} role="alert"><Icon n="alert" s={16} /><span>{err}</span></div>}

            {/* ======================= SIGN IN ======================= */}
            {step === 'signin' && (
              <form onSubmit={onSignIn} noValidate className="col" style={{ gap: 16, marginTop: 16 }}>
                <Input
                  type="email"
                  label="Email address"
                  placeholder="you@example.com"
                  value={email}
                  onChange={(e) => setEmail(e.target.value)}
                  error={fieldErr.email}
                  icon={<Icon n="mail" s={16} />}
                  autoComplete="username"
                  required
                />
                <Input
                  type="password"
                  label="Password"
                  placeholder="Enter your password"
                  value={password}
                  onChange={(e) => setPassword(e.target.value)}
                  error={fieldErr.password}
                  icon={<Icon n="lock" s={16} />}
                  showToggle
                  autoComplete="current-password"
                  required
                />
                <div className="between">
                  <span className="tiny"><Icon n="lock" s={12} /> Two-step sign-in is on</span>
                  <button type="button" className="btn-link" onClick={() => go('forgot')}>Forgot password?</button>
                </div>
                <Button
                  variant="primary"
                  size="lg"
                  fullWidth
                  disabled={busy}
                  loading={busy}
                >
                  Sign in as {ROLES.find((r) => r[0] === role)![1].toLowerCase()}
                </Button>
                <p className="au-switch">
                  New to PredictDx? <button type="button" className="btn-link" onClick={toSignup}>Create an account</button>
                </p>
              </form>
            )}

            {/* ======================= SIGN UP ======================= */}
            {step === 'signup' && (
              <form onSubmit={onSignUp} noValidate className="col" style={{ gap: 16, marginTop: 16 }}>
                <Input
                  label="Full name"
                  placeholder={role === 'DOCTOR' ? 'Dr Firstname Lastname' : 'Firstname Lastname'}
                  value={f.fullName}
                  onChange={(e) => set('fullName', e.target.value)}
                  error={fieldErr.fullName}
                  icon={<Icon n="user" s={16} />}
                  autoComplete="name"
                  required
                />
                <div className="au-2">
                  <Input
                    type="email"
                    label="Email"
                    placeholder="you@example.com"
                    value={email}
                    onChange={(e) => setEmail(e.target.value)}
                    error={fieldErr.email}
                    autoComplete="email"
                    required
                  />
                  <Input
                    type="tel"
                    label="Phone (optional)"
                    placeholder="+92 300 1234567"
                    value={f.phone}
                    onChange={(e) => set('phone', e.target.value)}
                    error={fieldErr.phone}
                    autoComplete="tel"
                  />
                </div>
                {role === 'PATIENT' ? (
                  <div className="au-3">
                    <Input
                      type="date"
                      label="Date of birth"
                      value={f.dateOfBirth}
                      max={new Date().toISOString().slice(0, 10)}
                      onChange={(e) => set('dateOfBirth', e.target.value)}
                    />
                    <div className="field">
                      <label className="form-label">Gender</label>
                      <select className="inp" style={{ padding: '12px 16px' }} value={f.gender} onChange={(e) => set('gender', e.target.value)}>
                        <option value="FEMALE">Female</option>
                        <option value="MALE">Male</option>
                        <option value="OTHER">Other</option>
                      </select>
                    </div>
                    <Input
                      label="City"
                      value={f.city}
                      onChange={(e) => set('city', e.target.value)}
                    />
                  </div>
                ) : (
                  <>
                    <div className="au-2">
                      <div className="field">
                        <label className="form-label">Speciality</label>
                        <select className="inp" style={{ padding: '12px 16px' }} value={f.specialization} onChange={(e) => set('specialization', e.target.value)}>
                          {SPECIALITIES.map((s) => <option key={s}>{s}</option>)}
                        </select>
                      </div>
                      <Input
                        label="PMDC number"
                        placeholder="e.g. 44192"
                        value={f.pmdcNumber}
                        onChange={(e) => set('pmdcNumber', e.target.value)}
                        error={fieldErr.pmdcNumber}
                        required
                      />
                    </div>
                    <div className="au-2">
                      <Input
                        label="Qualification"
                        placeholder="MBBS, FCPS"
                        value={f.qualification}
                        onChange={(e) => set('qualification', e.target.value)}
                        error={fieldErr.qualification}
                        required
                      />
                      <Input
                        label="Hospital"
                        placeholder="Hospital or clinic"
                        value={f.hospital}
                        onChange={(e) => set('hospital', e.target.value)}
                        error={fieldErr.hospital}
                        required
                      />
                    </div>
                    <div className="au-2">
                      <Input
                        label="City"
                        value={f.city}
                        onChange={(e) => set('city', e.target.value)}
                      />
                      <Input
                        type="number"
                        label="Consultation fee (Rs)"
                        min={0}
                        value={f.fee}
                        onChange={(e) => set('fee', e.target.value)}
                      />
                    </div>
                    <div className="field">
                      <label className="form-label">PMDC licence (PDF, JPG or PNG · max 5 MB)</label>
                      <label className={`inp${fieldErr.licence ? ' bad' : ''}`} style={{ cursor: 'pointer', padding: '12px 16px' }}>
                        <Icon n="up" s={16} />
                        <span className="grow" style={{ fontSize: 14 }}>{licence ? licence.name : 'Choose file…'}</span>
                        <input type="file" accept=".pdf,.jpg,.jpeg,.png,application/pdf,image/jpeg,image/png" hidden onChange={(e) => setLicence(e.target.files?.[0] ?? null)} />
                      </label>
                      {fieldErr.licence && <span className="err">{fieldErr.licence}</span>}
                    </div>
                  </>
                )}
                <div className="au-2">
                  <Input
                    type="password"
                    label="Password"
                    placeholder="Create a strong password"
                    value={password}
                    onChange={(e) => setPassword(e.target.value)}
                    error={fieldErr.password}
                    icon={<Icon n="lock" s={16} />}
                    showToggle
                    autoComplete="new-password"
                    required
                  />
                  <Input
                    type="password"
                    label="Confirm password"
                    placeholder="Re-enter your password"
                    value={f.confirm}
                    onChange={(e) => set('confirm', e.target.value)}
                    error={fieldErr.confirm}
                    icon={<Icon n="lock" s={16} />}
                    autoComplete="new-password"
                    required
                  />
                </div>
                <Strength value={password} />
                <label className="form-check" style={{ fontSize: 13, alignItems: 'flex-start', gap: 10, color: fieldErr.agree ? 'var(--critical-red)' : 'inherit' }}>
                  <input type="checkbox" checked={f.agree} onChange={(e) => set('agree', e.target.checked)} style={{ marginTop: 2 }} />
                  <span>I understand PredictDx is a decision-support tool and agree to my data being processed for my care.</span>
                </label>
                {role === 'DOCTOR' && (
                  <div className="notice info"><Icon n="shield" s={16} /><span>After you verify your e-mail, an administrator checks your PMDC licence before you can sign in.</span></div>
                )}
                <Button
                  variant="primary"
                  size="lg"
                  fullWidth
                  disabled={busy}
                  loading={busy}
                >
                  Create {role === 'DOCTOR' ? 'doctor' : 'patient'} account
                </Button>
                <p className="au-switch">
                  Already have an account? <button type="button" className="btn-link" onClick={() => go('signin')}>Sign in</button>
                </p>
              </form>
            )}

            {/* ======================= OTP (verify e-mail / MFA) ======================= */}
            {(step === 'verify' || step === 'mfa') && (
              <div className="col" style={{ gap: 16, marginTop: 16 }}>
                <div className="au-otp-ic"><Icon n={step === 'mfa' && mfaMethod === 'TOTP' ? 'phone' : 'mail'} s={26} /></div>
                <h2 className="au-h">{step === 'verify' ? 'Verify your e-mail' : 'Two-step verification'}</h2>
                <p className="h-sub">
                  {step === 'mfa' && mfaMethod === 'TOTP'
                    ? 'Enter the 6-digit code from your authenticator app.'
                    : <>We sent a 6-digit code to <b style={{ color: 'var(--primary-blue)' }}>{masked}</b>. It expires in 5 minutes.</>}
                </p>
                <OtpInput onComplete={verifyCode} disabled={busy} />
                <div className="between">
                  <button className="btn-link" onClick={() => go('signin')}>
                    <Icon n="back" s={13} /> Back
                  </button>
                  {!(step === 'mfa' && mfaMethod === 'TOTP') && (
                    <button className="btn-link" disabled={cooldown > 0 || busy} onClick={resend}>
                      {cooldown > 0 ? `Resend in ${cooldown}s` : 'Resend code'}
                    </button>
                  )}
                </div>
                <div className="notice info">
                  <Icon n="shield" s={15} />
                  <span>Never share this code. PredictDx staff will never ask for it.</span>
                </div>
              </div>
            )}

            {/* ======================= FORGOT / RESET ======================= */}
            {step === 'forgot' && (
              <form onSubmit={onForgot} noValidate className="col" style={{ gap: 16, marginTop: 16 }}>
                <h2 className="au-h">Reset your password</h2>
                <p className="h-sub">Enter your account e-mail and we will send a reset code.</p>
                <Input
                  type="email"
                  label="Email address"
                  placeholder="you@example.com"
                  value={email}
                  onChange={(e) => setEmail(e.target.value)}
                  error={fieldErr.email}
                  icon={<Icon n="mail" s={16} />}
                  autoFocus
                  required
                />
                <Button
                  variant="primary"
                  fullWidth
                  disabled={busy}
                  loading={busy}
                >
                  Send reset code
                </Button>
                <button type="button" className="btn-link" onClick={() => go('signin')}>
                  <Icon n="back" s={13} /> Back to sign in
                </button>
              </form>
            )}
            {step === 'reset' && (
              <div className="col" style={{ gap: 16, marginTop: 16 }}>
                <h2 className="au-h">Choose a new password</h2>
                <p className="h-sub">If an account exists for <b style={{ color: 'var(--primary-blue)' }}>{email}</b>, a code is on its way. All other devices will be signed out.</p>
                <Input
                  type="password"
                  label="New password"
                  placeholder="Create a strong password"
                  value={newPw}
                  onChange={(e) => setNewPw(e.target.value)}
                  error={fieldErr.newPw}
                  icon={<Icon n="lock" s={16} />}
                  showToggle
                  autoComplete="new-password"
                  required
                />
                <Strength value={newPw} />
                <div className="eyebrow">Reset code</div>
                <OtpInput onComplete={onReset} disabled={busy} />
                <div className="between">
                  <button className="btn-link" onClick={() => go('signin')}>
                    <Icon n="back" s={13} /> Back
                  </button>
                  <button className="btn-link" disabled={cooldown > 0 || busy} onClick={resend}>
                    {cooldown > 0 ? `Resend in ${cooldown}s` : 'Resend code'}
                  </button>
                </div>
              </div>
            )}

            {step === 'pending' && (
              <div className="col" style={{ gap: 16, marginTop: 16 }}>
                <div className="au-otp-ic ok"><Icon n="check" s={26} /></div>
                <h2 className="au-h">E-mail verified</h2>
                <p className="h-sub">Your PMDC licence is now with an administrator. You will get an e-mail as soon as your doctor account is approved — then sign in here.</p>
                <Button variant="success" fullWidth onClick={() => go('signin')}>
                  Back to sign in
                </Button>
              </div>
            )}
          </div>
        </div>
      </div>

      {/* ---------------- image 1: bottom tagline ---------------- */}
      <div className="au-bottom">
        <div className="au-rule" />
        <div className="au-tag">Predict disease save lives</div>
      </div>
    </div>
  );
}


function Strength({ value }: { value: string }) {
  const met = RULES.filter(([r]) => r.test(value)).length;
  const tone = met <= 2 ? 'var(--crit)' : met < 5 ? 'var(--warn)' : 'var(--ok)';
  return (
    <div>
      <div className="meter"><i style={{ width: `${(met / 5) * 100}%`, background: tone }} /></div>
      <div className="ctr wrap" style={{ gap: 6, marginTop: 8 }}>
        {RULES.map(([r, l]) => (
          <span key={l} className={`chip ${r.test(value) ? 'ok' : ''}`} style={{ fontSize: 10 }}>{r.test(value) ? '✓' : '·'} {l}</span>
        ))}
      </div>
    </div>
  );
}

/** Six boxes: auto-advance, backspace to go back, paste a whole code, submit when full. */
export function OtpInput({ onComplete, disabled }: { onComplete: (code: string) => void; disabled?: boolean }) {
  const [digits, setDigits] = useState(['', '', '', '', '', '']);
  // Keystrokes can arrive faster than React re-renders, so the source of truth is a ref.
  const cur = useRef(['', '', '', '', '', '']);
  const refs = useRef<(HTMLInputElement | null)[]>([]);
  useEffect(() => refs.current[0]?.focus(), []);

  const update = (next: string[]) => {
    cur.current = next;
    setDigits(next);
    if (next.every((d) => d)) {
      onComplete(next.join(''));
      setTimeout(() => {
        cur.current = ['', '', '', '', '', ''];
        setDigits(cur.current);
        refs.current[0]?.focus();
      }, 400);
    }
  };
  return (
    <div className="otp" onPaste={(e) => {
      const code = e.clipboardData.getData('text').replace(/\D/g, '').slice(0, 6);
      if (code.length === 6) {
        e.preventDefault();
        update(code.split(''));
      }
    }}>
      {digits.map((d, i) => (
        <input
          key={i}
          ref={(el) => (refs.current[i] = el)}
          inputMode="numeric"
          autoComplete={i === 0 ? 'one-time-code' : 'off'}
          value={d}
          disabled={disabled}
          aria-label={`Digit ${i + 1}`}
          onChange={(e) => {
            // Several digits can land in one box (fast typing, SMS/e-mail autofill): spread them out.
            const typed = e.target.value.replace(/\D/g, '');
            const fresh = typed.startsWith(cur.current[i]) && typed.length > 1 ? typed.slice(cur.current[i].length) : typed;
            const next = [...cur.current];
            if (!fresh) next[i] = '';
            [...fresh].slice(0, 6 - i).forEach((ch, k) => (next[i + k] = ch));
            const last = Math.min(i + fresh.length, 5);
            if (fresh) refs.current[fresh.length && i + fresh.length <= 5 ? i + fresh.length : last]?.focus();
            update(next);
          }}
          onKeyDown={(e) => {
            if (e.key === 'Backspace' && !cur.current[i] && i > 0) refs.current[i - 1]?.focus();
          }}
        />
      ))}
    </div>
  );
}
