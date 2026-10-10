import { BadRequestException, Body, Controller, Get, HttpCode, Post, Req, Res, UploadedFile, UseInterceptors } from '@nestjs/common';
import { FileInterceptor } from '@nestjs/platform-express';
import { memoryStorage } from 'multer';
import { sniff } from '../files/files';
import { ApiBearerAuth, ApiTags } from '@nestjs/swagger';
import { Throttle } from '@nestjs/throttler';
import type { Request, Response } from 'express';
import { AuthService, ClientInfo } from './auth.service';
import { AuthUser, CurrentUser, Public } from '../common/decorators';
import { limit } from '../common/util';
import { ForgotDto, LoginDto, MfaVerifyDto, RegisterDto, ResendDto, ResetDto, VerifyEmailDto } from './dto';

export const REFRESH_COOKIE = 'pdx_rt';

const isMobile = (req: Request) => String(req.headers['x-client'] ?? '').toLowerCase() === 'mobile';
/** Cookie for browsers, request body for the mobile app. */
const refreshTokenOf = (req: Request): string | undefined =>
  req.cookies?.[REFRESH_COOKIE] ?? (isMobile(req) && typeof req.body?.refreshToken === 'string' ? req.body.refreshToken : undefined);

const client = (req: Request): ClientInfo => ({
  ip: req.ip ?? req.socket.remoteAddress,
  userAgent: req.headers['user-agent'],
});

/** Strict limits on everything that accepts a password or a code. */
const AUTH_LIMIT = { default: { limit: limit(10), ttl: 60_000 } };
const CODE_LIMIT = { default: { limit: limit(6), ttl: 60_000 } };

@ApiTags('7.1 Smart Entry Portal - authentication')
@Controller('auth')
export class AuthController {
  constructor(private readonly auth: AuthService) {}

  /**
   * Browsers: the refresh token never reaches JavaScript - it lives in an httpOnly,
   * SameSite=Strict cookie scoped to /api/v1/auth. The access token (15 min) is in the body.
   * The Flutter app (header X-Client: mobile) has no cookie jar, so it receives the refresh
   * token in the body and keeps it in the phone's encrypted secure storage.
   */
  private withCookie<T extends { refreshToken?: string }>(res: Response, result: T) {
    if (!result.refreshToken) return result;
    if (isMobile(res.req)) return result;
    res.cookie(REFRESH_COOKIE, result.refreshToken, {
      httpOnly: true,
      sameSite: 'strict',
      secure: process.env.NODE_ENV === 'production',
      path: '/api/v1/auth',
      maxAge: Number(process.env.REFRESH_TTL_DAYS ?? 7) * 86_400_000,
    });
    const { refreshToken: _hidden, ...rest } = result;
    return rest;
  }

  @Public()
  @Throttle(AUTH_LIMIT)
  @Post('register')
  @UseInterceptors(FileInterceptor('licence', { storage: memoryStorage(), limits: { fileSize: 5 * 1024 * 1024 } }))
  register(@Body() dto: RegisterDto, @Req() req: Request, @UploadedFile() licence?: Express.Multer.File) {
    let file: { data: Buffer; name: string; mime: string } | undefined;
    if (licence) {
      const kind = sniff(licence.buffer);
      if (!kind || !['pdf', 'jpg', 'png'].includes(kind.ext)) throw new BadRequestException('Upload your PMDC licence as a PDF, JPG or PNG');
      file = { data: licence.buffer, name: licence.originalname || `licence.${kind.ext}`, mime: kind.mime };
    }
    return this.auth.register(dto, client(req), file);
  }

  @Public()
  @Throttle(CODE_LIMIT)
  @HttpCode(200)
  @Post('verify-email')
  async verifyEmail(@Body() dto: VerifyEmailDto, @Req() req: Request, @Res({ passthrough: true }) res: Response) {
    return this.withCookie(res, (await this.auth.verifyEmail(dto.email, dto.code, client(req))) as any);
  }

  @Public()
  @Throttle(AUTH_LIMIT)
  @HttpCode(200)
  @Post('login')
  async login(@Body() dto: LoginDto, @Req() req: Request, @Res({ passthrough: true }) res: Response) {
    return this.withCookie(res, (await this.auth.login(dto, client(req))) as any);
  }

  @Public()
  @Throttle(CODE_LIMIT)
  @HttpCode(200)
  @Post('mfa/verify')
  async mfa(@Body() dto: MfaVerifyDto, @Req() req: Request, @Res({ passthrough: true }) res: Response) {
    return this.withCookie(res, await this.auth.verifyMfa(dto.mfaToken, dto.code, client(req)));
  }

  @Public()
  @Throttle(CODE_LIMIT)
  @HttpCode(200)
  @Post('otp/resend')
  resend(@Body() dto: ResendDto) {
    return this.auth.resend(dto.purpose as any, dto.email, dto.mfaToken);
  }

  @Public()
  @HttpCode(200)
  @Post('refresh')
  async refresh(@Req() req: Request, @Res({ passthrough: true }) res: Response) {
    try {
      return this.withCookie(res, await this.auth.refresh(refreshTokenOf(req), client(req)));
    } catch (e) {
      res.clearCookie(REFRESH_COOKIE, { path: '/api/v1/auth' });
      throw e;
    }
  }

  @Public()
  @HttpCode(200)
  @Post('logout')
  async logout(@Req() req: Request, @Res({ passthrough: true }) res: Response) {
    await this.auth.logout(refreshTokenOf(req));
    res.clearCookie(REFRESH_COOKIE, { path: '/api/v1/auth' });
    return { ok: true };
  }

  @Public()
  @Throttle(CODE_LIMIT)
  @HttpCode(200)
  @Post('password/forgot')
  forgot(@Body() dto: ForgotDto) {
    return this.auth.forgot(dto.email);
  }

  @Public()
  @Throttle(CODE_LIMIT)
  @HttpCode(200)
  @Post('password/reset')
  reset(@Body() dto: ResetDto, @Req() req: Request) {
    return this.auth.reset(dto, client(req));
  }

  @ApiBearerAuth()
  @Get('me')
  me(@CurrentUser() me: AuthUser) {
    return this.auth.me(me.id);
  }
}
