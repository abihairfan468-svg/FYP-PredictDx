import { Global, Injectable, Logger, Module } from '@nestjs/common';
import nodemailer, { Transporter } from 'nodemailer';

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

  async send(to: string, subject: string, text: string) {
    if (!this.transporter) {
      this.log.log(`e-mail to ${to} | ${subject} | ${text.replace(/\n/g, ' ')}`);
      return;
    }
    const safe = text.replace(/&/g, '&amp;').replace(/</g, '&lt;');
    try {
      await this.transporter.sendMail({
        from: process.env.MAIL_FROM ?? 'PredictDx <no-reply@predictdx.com>',
        to,
        subject,
        text,
        html: `<div style="font-family:Arial,sans-serif;background:#1E1D2B;color:#DCEBFF;padding:28px;border-radius:12px">
          <h2 style="color:#A9DBFF;letter-spacing:.06em;margin:0 0 14px">PREDICTDX</h2>
          <p style="white-space:pre-line;line-height:1.6;margin:0">${safe}</p>
          <p style="color:#7E8BA8;font-size:12px;margin-top:22px">Predict disease &middot; save lives</p></div>`,
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
