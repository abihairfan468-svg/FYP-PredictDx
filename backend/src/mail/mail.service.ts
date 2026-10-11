import { Global, Injectable, Logger, Module } from '@nestjs/common';
import nodemailer, { Transporter } from 'nodemailer';
import { noticeEmail } from './templates';

/**
 * Sends transactional e-mail (OTP codes, booking confirmations).
 * With SMTP configured it delivers for real (any SMTP provider: Brevo, Gmail App password,
 * SMTP2GO...); without it the message is printed to the server console so the system can be demoed offline.
 */
@Injectable()
export class MailService {
  private readonly log = new Logger('Mail');
  private transporter: Transporter | null = null;

  constructor() {
    if (process.env.SMTP_HOST && process.env.SMTP_USER && process.env.SMTP_PASS) {
      this.transporter = nodemailer.createTransport({
        host: process.env.SMTP_HOST,
        port: Number(process.env.SMTP_PORT ?? 465),
        secure: process.env.SMTP_SECURE !== 'false',
        auth: { user: process.env.SMTP_USER, pass: process.env.SMTP_PASS.replace(/\s+/g, '') },
      });
      // Log in once at startup so a wrong App password shows up immediately, not at the first sign-in.
      this.transporter
        .verify()
        .then(() => this.log.log(`SMTP ready: codes are e-mailed from ${process.env.SMTP_USER} via ${process.env.SMTP_HOST}`))
        .catch((e) => this.log.error(`SMTP login failed (${e.message}). Check SMTP_USER / SMTP_PASS in backend/.env; for Brevo also allow this computer's IP under Security > Authorized IPs`));
    } else {
      this.log.warn('SMTP_HOST / SMTP_USER / SMTP_PASS not set - e-mails are printed to this console instead');
    }
  }

  /** `html` is optional: without it the text is laid out in the standard PredictDx template. */
  async send(to: string, subject: string, text: string, html?: string) {
    // Demo accounts use addresses on domains we do not own (predictdx.com belongs to someone else):
    // never deliver to them, so a demo sign-in can never e-mail a stranger. Codes stay in this terminal.
    const domain = to.split('@')[1]?.toLowerCase() ?? '';
    const demoDomains = (process.env.MAIL_DEMO_DOMAINS ?? 'predictdx.com').split(',').map((d) => d.trim().toLowerCase());
    if (!this.transporter || demoDomains.includes(domain)) {
      this.log.log(`e-mail to ${to} | ${subject} | ${text.replace(/\n/g, ' ')}`);
      return;
    }
    try {
      await this.transporter.sendMail({
        from: process.env.MAIL_FROM ?? 'PredictDx <no-reply@predictdx.com>',
        to,
        subject,
        text,
        html: html ?? noticeEmail(subject, text),
      });
      this.log.log(`e-mail sent to ${to} | ${subject}`);
    } catch (e) {
      this.log.error(`Could not send e-mail to ${to}: ${(e as Error).message}`);
      // development fallback so a demo is never stuck: the message still appears in this terminal
      if (process.env.NODE_ENV !== 'production') this.log.warn(`undelivered e-mail to ${to} | ${subject} | ${text.replace(/\n/g, ' ')}`);
    }
  }
}

@Global()
@Module({ providers: [MailService], exports: [MailService] })
export class MailModule {}
