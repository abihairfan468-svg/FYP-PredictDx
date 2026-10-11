import { Global, Injectable, Logger, Module } from '@nestjs/common';
import nodemailer, { Transporter } from 'nodemailer';
import { noticeEmail } from './templates';

const BREVO_API = 'https://api.brevo.com/v3/smtp/email';

/** "PredictDx <a@b.com>" -> { name, email } */
function parseFrom(from: string) {
  const m = from.match(/^\s*"?([^"<]*?)"?\s*<([^>]+)>\s*$/);
  return m ? { name: m[1].trim() || 'PredictDx', email: m[2].trim() } : { name: 'PredictDx', email: from.trim() };
}

/**
 * Sends transactional e-mail (OTP codes, booking confirmations, prescriptions).
 * Delivery, in order of preference:
 *   1. BREVO_API_KEY  - Brevo HTTPS API; works from any server (cloud hosts change IP addresses).
 *   2. SMTP_HOST/USER/PASS - any SMTP provider (Brevo SMTP, Gmail App password, SMTP2GO...).
 *   3. neither - the message is printed to the server console so the system can be demoed offline.
 */
@Injectable()
export class MailService {
  private readonly log = new Logger('Mail');
  private transporter: Transporter | null = null;
  private readonly apiKey = process.env.BREVO_API_KEY?.trim() || null;
  private readonly from = process.env.MAIL_FROM ?? 'PredictDx <no-reply@predictdx.com>';

  constructor() {
    if (this.apiKey) {
      this.log.log(`E-mail via Brevo API, sender ${this.from}`);
    } else if (process.env.SMTP_HOST && process.env.SMTP_USER && process.env.SMTP_PASS) {
      this.transporter = nodemailer.createTransport({
        host: process.env.SMTP_HOST,
        port: Number(process.env.SMTP_PORT ?? 465),
        secure: process.env.SMTP_SECURE !== 'false',
        auth: { user: process.env.SMTP_USER, pass: process.env.SMTP_PASS.replace(/\s+/g, '') },
      });
      // Log in once at startup so a wrong password shows up immediately, not at the first sign-in.
      this.transporter
        .verify()
        .then(() => this.log.log(`SMTP ready: codes are e-mailed from ${process.env.SMTP_USER} via ${process.env.SMTP_HOST}`))
        .catch((e) => this.log.error(`SMTP login failed (${e.message}). Check SMTP_USER / SMTP_PASS in backend/.env; for Brevo also allow this computer's IP under Security > Authorized IPs`));
    } else {
      this.log.warn('No BREVO_API_KEY or SMTP settings - e-mails are printed to this console instead');
    }
  }

  /** `html` is optional: without it the text is laid out in the standard PredictDx template. */
  async send(to: string, subject: string, text: string, html?: string) {
    // Demo accounts use addresses on domains we do not own (predictdx.com belongs to someone else):
    // never deliver to them, so a demo sign-in can never e-mail a stranger. Codes stay in this log.
    const domain = to.split('@')[1]?.toLowerCase() ?? '';
    const demoDomains = (process.env.MAIL_DEMO_DOMAINS ?? 'predictdx.com').split(',').map((d) => d.trim().toLowerCase());
    if ((!this.apiKey && !this.transporter) || demoDomains.includes(domain)) {
      this.log.log(`e-mail to ${to} | ${subject} | ${text.replace(/\n/g, ' ')}`);
      return;
    }
    const body = html ?? noticeEmail(subject, text);
    try {
      if (this.apiKey) await this.sendViaApi(to, subject, text, body);
      else await this.transporter!.sendMail({ from: this.from, to, subject, text, html: body });
      this.log.log(`e-mail sent to ${to} | ${subject}`);
    } catch (e) {
      this.log.error(`Could not send e-mail to ${to}: ${(e as Error).message}`);
      // development fallback so a demo is never stuck: the message still appears in this terminal
      if (process.env.NODE_ENV !== 'production') this.log.warn(`undelivered e-mail to ${to} | ${subject} | ${text.replace(/\n/g, ' ')}`);
    }
  }

  private async sendViaApi(to: string, subject: string, text: string, html: string) {
    const res = await fetch(BREVO_API, {
      method: 'POST',
      headers: { 'api-key': this.apiKey!, 'content-type': 'application/json', accept: 'application/json' },
      body: JSON.stringify({ sender: parseFrom(this.from), to: [{ email: to }], subject, textContent: text, htmlContent: html }),
      signal: AbortSignal.timeout(15_000),
    });
    if (!res.ok) throw new Error(`Brevo API ${res.status}: ${(await res.text()).slice(0, 200)}`);
  }
}

@Global()
@Module({ providers: [MailService], exports: [MailService] })
export class MailModule {}
