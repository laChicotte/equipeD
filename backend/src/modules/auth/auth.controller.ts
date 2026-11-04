import { Body, Controller, Get, HttpCode, Post, Req, Res } from '@nestjs/common';
import { ApiTags } from '@nestjs/swagger';
import { Throttle } from '@nestjs/throttler';
import type { Request, Response } from 'express';
import { AppConfigService } from '../../config/app-config.service.js';
import { CurrentUser, Public } from '../../common/auth/decorators.js';
import type { AuthUser } from '../../common/auth/auth-user.js';
import { AuthService, type IssuedSession } from './auth.service.js';
import { LoginDto, RegisterDto } from './auth.dto.js';

@ApiTags('auth')
@Controller('auth')
export class AuthController {
  constructor(
    private readonly auth: AuthService,
    private readonly config: AppConfigService,
  ) {}

  /** Création de compte (mentoré ou mentor) et ouverture de session. */
  @Public()
  @Throttle({ default: { limit: 5, ttl: 60_000 } })
  @Post('register')
  async register(@Body() dto: RegisterDto, @Req() req: Request, @Res({ passthrough: true }) res: Response) {
    const session = await this.auth.register(dto, req.headers['user-agent']);
    this.setCookie(res, session);
    return { ok: true };
  }

  /** Connexion par email et mot de passe. Limité à 10 tentatives par minute et par IP. */
  @Public()
  @Throttle({ default: { limit: 10, ttl: 60_000 } })
  @HttpCode(200)
  @Post('login')
  async login(@Body() dto: LoginDto, @Req() req: Request, @Res({ passthrough: true }) res: Response) {
    const session = await this.auth.login(dto, req.headers['user-agent']);
    this.setCookie(res, session);
    return { ok: true };
  }

  /** Révoque la session courante côté serveur et efface le cookie. */
  @HttpCode(200)
  @Post('logout')
  async logout(@CurrentUser() user: AuthUser, @Res({ passthrough: true }) res: Response) {
    await this.auth.logout(user.sessionId);
    res.clearCookie(this.config.get('SESSION_COOKIE_NAME'), this.cookieBase());
    return { ok: true };
  }

  @Get('me')
  me(@CurrentUser() user: AuthUser) {
    return this.auth.me(user.id);
  }

  private cookieBase() {
    return {
      httpOnly: true,
      secure: this.config.isProduction,
      sameSite: 'lax' as const,
      path: '/',
    };
  }

  private setCookie(res: Response, session: IssuedSession) {
    res.cookie(this.config.get('SESSION_COOKIE_NAME'), session.token, {
      ...this.cookieBase(),
      expires: session.expiresAt,
    });
  }
}
