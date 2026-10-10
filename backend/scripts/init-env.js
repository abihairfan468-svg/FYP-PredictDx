/**
 * Creates backend/.env from .env.example on first setup, with fresh random secrets.
 * Never overwrites an existing .env.
 */
const fs = require('fs');
const path = require('path');
const crypto = require('crypto');

const dir = path.resolve(__dirname, '..');
const target = path.join(dir, '.env');
if (fs.existsSync(target)) {
  console.log('backend/.env already exists - leaving it as it is');
  process.exit(0);
}
const rnd = (n) => crypto.randomBytes(n).toString('hex');
const env = fs
  .readFileSync(path.join(dir, '.env.example'), 'utf8')
  .replace('change-me-access-secret-at-least-32-characters', rnd(32))
  .replace('change-me-mfa-secret-at-least-32-characters', rnd(32))
  .replace('change-me-otp-pepper', rnd(16));
fs.writeFileSync(target, env);
console.log('Created backend/.env with new random secrets');
