import { BadRequestException, Body, Controller, Delete, Get, HttpCode, NotFoundException, Param, Post } from '@nestjs/common';
import { Authenticate, CurrentUser } from '@nestjs/authentication';
import { ApiTags } from '@nestjs/swagger';
import { createApiKeySchema, type CreateApiKeyInput } from '@edumanage/shared';
import { AuditService } from '../audit/audit.service.js';
import { RequirePermission } from '../auth/access.policy.js';
import type { AuthUser } from '../auth/auth-user.js';
import { ApiKeyAuth, JwtAuth, SessionAuth } from '../auth/providers.js';
import { PrismaService } from '../prisma/prisma.service.js';

/**
 * Keys for the public API (`Authorization: Bearer edm_…`). A key acts as the
 * user who created it, with that user's current permissions. Keys can only be
 * managed by a signed-in person, never by another key.
 */
@ApiTags('API keys')
@Controller('api-keys')
@Authenticate({ providers: [SessionAuth, JwtAuth] })
@RequirePermission('api_keys.manage')
export class ApiKeysController {
  constructor(
    private readonly prisma: PrismaService,
    private readonly apiKeyAuth: ApiKeyAuth,
    private readonly audit: AuditService,
  ) {}

  @Get()
  list(@CurrentUser() user: AuthUser) {
    return this.prisma.apiKey.findMany({
      where: { institutionId: this.tenant(user) },
      select: { id: true, name: true, expiresAt: true, lastUsedAt: true, revokedAt: true, createdAt: true, user: { select: { fullName: true } } },
      orderBy: { createdAt: 'desc' },
    });
  }

  @Post()
  async create(@CurrentUser() user: AuthUser, @Body({ schema: createApiKeySchema }) body: CreateApiKeyInput) {
    const institutionId = this.tenant(user);
    const { key, id, hash } = this.apiKeyAuth.generate();
    const expiresAt = new Date(Date.now() + body.expiresInDays * 24 * 60 * 60 * 1000);
    await this.prisma.apiKey.create({ data: { id, hash, name: body.name, userId: user.id, institutionId, expiresAt } });
    await this.audit.record({ institutionId, action: 'api_key.created', entityType: 'api_key', entityId: id, changes: { name: body.name } });
    // The whole key is shown once; only its hash is stored.
    return { id, name: body.name, key, expiresAt };
  }

  @Delete(':id')
  @HttpCode(204)
  async revoke(@CurrentUser() user: AuthUser, @Param('id') id: string) {
    const institutionId = this.tenant(user);
    const { count } = await this.prisma.apiKey.updateMany({ where: { id, institutionId, revokedAt: null }, data: { revokedAt: new Date() } });
    if (!count) throw new NotFoundException('API key not found');
    await this.audit.record({ institutionId, action: 'api_key.revoked', entityType: 'api_key', entityId: id });
  }

  /** Keys belong to an institution account; a Super Admin key would carry platform-wide power. */
  private tenant(user: AuthUser) {
    if (!user.institutionId) throw new BadRequestException('API keys belong to institution accounts');
    return user.institutionId;
  }
}
