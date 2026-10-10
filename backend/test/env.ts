// Runs before every e2e test file: an isolated database and deterministic settings.
import { readFileSync } from 'fs';
import { resolve } from 'path';

process.env.NODE_ENV = 'test';
process.env.DATABASE_URL = readFileSync(resolve(__dirname, '.db-url'), 'utf8').trim();
process.env.JWT_ACCESS_SECRET = 'test-access-secret-0123456789abcdef0123456789';
process.env.JWT_MFA_SECRET = 'test-mfa-secret-0123456789abcdef0123456789abcd';
process.env.JWT_ACCESS_TTL = '15m';
process.env.OTP_PEPPER = 'test-pepper';
process.env.OTP_DEV_ECHO = 'true';
process.env.OTP_RESEND_COOLDOWN_SECONDS = '0';
process.env.RATE_LIMIT_SCALE = '100';
process.env.SMTP_HOST = '';
process.env.WEB_ORIGIN = 'http://localhost:5173';
