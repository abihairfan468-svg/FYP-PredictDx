import { randomBytes, randomInt, createHash } from 'crypto';

export const sha256 = (s: string) => createHash('sha256').update(s).digest('hex');
export const randomToken = (bytes = 32) => randomBytes(bytes).toString('base64url');
export const sixDigitCode = () => String(randomInt(0, 1_000_000)).padStart(6, '0');

/** Short human-friendly reference, e.g. RX-4F9K2A. */
export const shortCode = (prefix: string) =>
  `${prefix}-${randomBytes(3).toString('hex').toUpperCase()}`;

export const parseJson = <T>(s: string | null | undefined, fallback: T): T => {
  if (!s) return fallback;
  try {
    return JSON.parse(s) as T;
  } catch {
    return fallback;
  }
};

/**
 * Rate-limit budget. RATE_LIMIT_SCALE lets the automated test suite (hundreds of requests
 * from one IP) run without tripping the limits; production leaves it at 1.
 */
export const limit = (n: number) => n * Number(process.env.RATE_LIMIT_SCALE || 1);

export const startOfDay =(d = new Date()) => new Date(d.getFullYear(), d.getMonth(), d.getDate());
export const addDays = (d: Date, n: number) => new Date(d.getTime() + n * 86_400_000);
