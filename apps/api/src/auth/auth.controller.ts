import { Body, Controller, Delete, Get, HttpCode, Param, Post, UnauthorizedException } from '@nestjs/common';
import {
  CurrentSession,
  CurrentUser,
  Public,
  SessionService,
  SignInService,
  TokenService,
  type SessionRecord,
} from '@nestjs/authentication';
import { Can } from '@nestjs/authorization';
import { Throttle } from '@nestjs/throttler';
import { ApiBearerAuth, ApiOperation, ApiTags } from '@nestjs/swagger';
import {
  changePasswordSchema,
  refreshTokenSchema,
  signInSchema,
  type ChangePasswordInput,
  type SignInInput,
} from '@edumanage/shared';
import { AuditService } from '../audit/audit.service.js';
import { PrismaService } from '../prisma/prisma.service.js';
import type { AuthUser } from './auth-user.js';
import { CredentialsService } from './credentials.service.js';
import { MeService } from './me.service.js';

/**
 * Sign-in attempts: 10 per minute for one email from one IP, and 120 per
 * minute from one IP in total (a computer lab signing in at once still fits).
 */
const SIGN_IN_LIMIT = { default: { limit: 10, ttl: 60_000 }, ip: { limit: 120, ttl: 60_000 } };

@ApiTags('Auth')
@Controller('auth')
export class AuthController {
  constructor(
    private readonly credentials: CredentialsService,
    private readonly signInService: SignInService,
    private readonly sessions: SessionService,
    private readonly tokens: TokenService,
    private readonly me: MeService,
    private readonly audit: AuditService,
    private readonly prisma: PrismaService,
  ) {}

  // ── Web: session cookie ───────────────────────────────────────────────────

  @Public()
  @Throttle(SIGN_IN_LIMIT)
  @Post('sign-in')
  @HttpCode(200)
  @ApiOperation({ summary: 'Web sign-in: sets the HttpOnly session cookie' })
  async signIn(@Body({ schema: signInSchema }) body: SignInInput) {
    const userId = await this.authenticate(body);
    await this.signInService.signIn(userId, { method: 'password' });
    return this.me.build(userId);
  }

  @Post('sign-out')
  @HttpCode(204)
  @Can.Anyone()
  async signOut() {
    await this.signInService.signOut();
  }

  @Post('sign-out-everywhere')
  @HttpCode(204)
  @Can.Anyone()
  async signOutEverywhere(@CurrentUser() user: AuthUser) {
    await this.signInService.signOutEverywhere(user.id);
    await this.audit.record({ institutionId: user.institutionId, action: 'auth.signed_out_everywhere', entityType: 'user', entityId: user.id });
  }

  // ── Mobile & integrations: bearer tokens ──────────────────────────────────

  @Public()
  @Throttle(SIGN_IN_LIMIT)
  @Post('token')
  @HttpCode(200)
  @ApiOperation({ summary: 'Mobile sign-in: returns an access token (15 min) and a rotating refresh token' })
  async issueToken(@Body({ schema: signInSchema }) body: SignInInput) {
    const userId = await this.authenticate(body);
    const tokens = await this.tokens.issue(userId, { method: 'password', claims: { amr: ['pwd'] } });
    return { ...tokens, user: await this.me.build(userId) };
  }

  @Public()
  @Throttle(SIGN_IN_LIMIT)
  @Post('token/refresh')
  @HttpCode(200)
  @ApiOperation({ summary: 'Spend a refresh token for a new pair. A reused token revokes its whole family.' })
  refresh(@Body({ schema: refreshTokenSchema }) body: { refreshToken: string }) {
    return this.tokens.refresh(body.refreshToken);
  }

  @Public()
  @Post('token/revoke')
  @HttpCode(204)
  async revoke(@Body({ schema: refreshTokenSchema }) body: { refreshToken: string }) {
    await this.tokens.revoke(body.refreshToken);
  }

  // ── Current user ──────────────────────────────────────────────────────────

  @Get('me')
  @Can.Anyone()
  @ApiBearerAuth()
  getMe(@CurrentUser() user: AuthUser) {
    return this.me.build(user.id);
  }

  @Post('password')
  @HttpCode(204)
  @Can.Anyone()
  @Throttle(SIGN_IN_LIMIT)
  async changePassword(
    @CurrentUser() user: AuthUser,
    @CurrentSession() session: SessionRecord | null,
    @Body({ schema: changePasswordSchema }) body: ChangePasswordInput,
  ) {
    if (!(await this.credentials.verifyById(user.id, body.currentPassword))) {
      throw new UnauthorizedException('Current password is incorrect');
    }
    await this.prisma.user.update({ where: { id: user.id }, data: { passwordHash: await this.credentials.hash(body.newPassword) } });
    // Whoever knew the old password may still be signed in elsewhere.
    const current = session && 'lastActiveAt' in session ? session.id : undefined;
    await this.sessions.revokeAll(user.id, { except: current });
    await this.tokens.revokeAll(user.id);
    if (current) {
      await this.signInService.rotateSession();
    }
    await this.audit.record({ institutionId: user.institutionId, action: 'auth.password_changed', entityType: 'user', entityId: user.id });
  }

  @Get('sessions')
  @Can.Anyone()
  async listSessions(@CurrentUser() user: AuthUser, @CurrentSession() session: SessionRecord | null) {
    const sessions = await this.sessions.list(user.id);
    return sessions.map((s) => ({
      id: s.id,
      createdAt: s.createdAt,
      lastActiveAt: s.lastActiveAt,
      expiresAt: s.expiresAt,
      current: s.id === session?.id,
      userAgent: s.metadata?.['userAgent'] ?? null,
      ip: s.metadata?.['ip'] ?? null,
    }));
  }

  @Delete('sessions/:id')
  @HttpCode(204)
  @Can.Anyone()
  async revokeSession(@CurrentUser() user: AuthUser, @Param('id') id: string) {
    await this.sessions.revoke(id, { userId: user.id });
  }

  /** Shared by cookie and token sign-in: verifies the password and that the account may act. */
  private async authenticate(body: SignInInput): Promise<string> {
    const userId = await this.credentials.verify(body.institution, body.email, body.password);
    // `me.canSignIn` rejects suspended users and institutions with the same message,
    // so the response never reveals which of the two was wrong.
    if (!userId || !(await this.me.canSignIn(userId))) {
      throw new UnauthorizedException('Invalid institution, email or password');
    }
    const user = await this.prisma.user.update({
      where: { id: userId },
      data: { lastSignInAt: new Date() },
      select: { id: true, fullName: true, institutionId: true },
    });
    await this.audit.record({
      institutionId: user.institutionId,
      action: 'auth.signed_in',
      entityType: 'user',
      entityId: user.id,
      actor: { id: user.id, fullName: user.fullName },
    });
    return userId;
  }
}
