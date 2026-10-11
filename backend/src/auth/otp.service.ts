import { BadRequestException, HttpException, HttpStatus, Injectable } from '@nestjs/common';
import { PrismaService } from '../prisma/prisma.service';
import { MailService } from '../mail/mail.service';
import { sha256, sixDigitCode } from '../common/util';
import { codeEmail } from '../mail/templates';

export type OtpPurpose = 'VERIFY_EMAIL' | 'LOGIN_MFA' | 'RESET_PASSWORD';

const TTL_MS = 5 * 60_000;
const RESEND_COOLDOWN_MS = Number(process.env.OTP_RESEND_COOLDOWN_SECONDS ?? 30) * 1000;
const MAX_ATTEMPTS = 5;

/**
 * Six-digit one-time codes. Only a peppered SHA-256 hash is stored; a code expires after
 * five minutes, dies after five wrong guesses, and is single-use. Issuing a new code
 * invalidates the previous one for the same purpose.
 */
@Injectable()
export class OtpService {
  constructor(
    private readonly prisma: PrismaService,
    private readonly mail: MailService,
  ) {}

  private hash(userId: string, code: string) {
    return sha256(`${userId}:${code}:${process.env.OTP_PEPPER ?? ''}`);
  }

  /** Creates and sends a code. Returns the plain code only when OTP_DEV_ECHO=true. */
  async issue(user: { id: string; email: string; fullName: string }, purpose: OtpPurpose) {
    const last = await this.prisma.otpCode.findFirst({
      where: { userId: user.id, purpose, consumedAt: null },
      orderBy: { createdAt: 'desc' },
    });
    if (last && Date.now() - last.createdAt.getTime() < RESEND_COOLDOWN_MS) {
      const wait = Math.ceil((RESEND_COOLDOWN_MS - (Date.now() - last.createdAt.getTime())) / 1000);
      throw new HttpException(`Please wait ${wait}s before asking for another code`, HttpStatus.TOO_MANY_REQUESTS);
    }

    await this.prisma.otpCode.updateMany({
      where: { userId: user.id, purpose, consumedAt: null },
      data: { consumedAt: new Date() },
    });
    const code = sixDigitCode();
    await this.prisma.otpCode.create({
      data: {
        userId: user.id,
        purpose,
        codeHash: this.hash(user.id, code),
        expiresAt: new Date(Date.now() + TTL_MS),
      },
    });

    const email = codeEmail(purpose, user.fullName, code, TTL_MS / 60_000);
    await this.mail.send(user.email, email.subject, email.text, email.html);
    return process.env.OTP_DEV_ECHO === 'true' ? code : undefined;
  }

  /** Throws unless `code` is the live code for this user and purpose. Consumes it on success. */
  async verify(userId: string, purpose: OtpPurpose, code: string) {
    const otp = await this.prisma.otpCode.findFirst({
      where: { userId, purpose, consumedAt: null },
      orderBy: { createdAt: 'desc' },
    });
    if (!otp || otp.expiresAt < new Date()) {
      throw new BadRequestException('This code has expired. Ask for a new one.');
    }
    if (otp.attempts >= MAX_ATTEMPTS) {
      throw new BadRequestException('Too many wrong codes. Ask for a new one.');
    }
    if (otp.codeHash !== this.hash(userId, code)) {
      const attempts = otp.attempts + 1;
      await this.prisma.otpCode.update({ where: { id: otp.id }, data: { attempts } });
      const left = MAX_ATTEMPTS - attempts;
      throw new BadRequestException(
        left > 0 ? `That code is not right. ${left} attempt${left === 1 ? '' : 's'} left.` : 'Too many wrong codes. Ask for a new one.',
      );
    }
    await this.prisma.otpCode.update({ where: { id: otp.id }, data: { consumedAt: new Date() } });
  }
}
