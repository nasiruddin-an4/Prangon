import { Injectable } from '@nestjs/common';
import {
  ApiKeyProvider,
  AuthenticationRegistry,
  JwtBearerProvider,
  SessionCookieProvider,
  type JwtClaims,
  type SessionRecord,
} from '@nestjs/authentication';
import { PrismaService } from '../prisma/prisma.service.js';
import type { AuthUser } from './auth-user.js';
import { PrincipalService } from './principal.service.js';

/** Web app: the `__Host-sid` session cookie. Asked first. */
@Injectable()
export class SessionAuth extends SessionCookieProvider<AuthUser> {
  constructor(
    private readonly principals: PrincipalService,
    registry: AuthenticationRegistry,
  ) {
    super();
    registry.registerProvider(this, { order: 0 });
  }

  validate(session: SessionRecord) {
    return this.principals.load(session.userId);
  }
}

/** Mobile app: short-lived JWT access tokens in `Authorization: Bearer`. */
@Injectable()
export class JwtAuth extends JwtBearerProvider<AuthUser> {
  constructor(
    private readonly principals: PrincipalService,
    registry: AuthenticationRegistry,
  ) {
    super({ realm: 'edumanage' });
    registry.registerProvider(this, { order: 1 });
  }

  validate({ sub }: JwtClaims) {
    return sub ? this.principals.load(sub) : null;
  }
}

/** Public API: `Authorization: Bearer edm_<id>_<secret>` keys created by institutions. */
@Injectable()
export class ApiKeyAuth extends ApiKeyProvider<AuthUser> {
  constructor(
    private readonly prisma: PrismaService,
    private readonly principals: PrincipalService,
    registry: AuthenticationRegistry,
  ) {
    super({ prefix: 'edm', realm: 'edumanage-api' });
    registry.registerProvider(this, { order: 2 });
  }

  protected async findKey(id: string) {
    const key = await this.prisma.apiKey.findFirst({ where: { id, revokedAt: null } });
    if (!key) {
      return null;
    }
    const user = await this.principals.load(key.userId);
    if (!user) {
      return null;
    }
    // Best-effort usage stamp; never blocks or fails the request.
    void this.prisma.apiKey.update({ where: { id }, data: { lastUsedAt: new Date() } }).catch(() => undefined);
    return { hash: key.hash, user, expiresAt: key.expiresAt };
  }
}
