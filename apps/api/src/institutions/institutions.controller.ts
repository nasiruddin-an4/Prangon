import { Body, Controller, Get, Param, ParseUUIDPipe, Patch, Post, Query } from '@nestjs/common';
import { CurrentUser } from '@nestjs/authentication';
import { ApiHeader, ApiTags } from '@nestjs/swagger';
import {
  createInstitutionSchema,
  paginationSchema,
  updateInstitutionSettingsSchema,
  updateInstitutionStatusSchema,
  type CreateInstitutionInput,
  type PaginationInput,
  type UpdateInstitutionSettingsInput,
} from '@edumanage/shared';
import { RequirePermission } from '../auth/access.policy.js';
import type { AuthUser } from '../auth/auth-user.js';
import { TenantId } from '../common/tenant.decorator.js';
import { InstitutionsService } from './institutions.service.js';

/** Platform administration: every institution on the SaaS. */
@ApiTags('Platform: institutions')
@Controller('platform/institutions')
@RequirePermission('platform.institutions.manage')
export class PlatformInstitutionsController {
  constructor(private readonly institutions: InstitutionsService) {}

  @Get()
  list(@Query({ schema: paginationSchema }) query: PaginationInput) {
    return this.institutions.list(query);
  }

  @Post()
  create(@CurrentUser() user: AuthUser, @Body({ schema: createInstitutionSchema }) body: CreateInstitutionInput) {
    return this.institutions.create(body, user.id);
  }

  @Patch(':id/status')
  setStatus(@Param('id', ParseUUIDPipe) id: string, @Body({ schema: updateInstitutionStatusSchema }) body: { status: 'TRIAL' | 'ACTIVE' | 'SUSPENDED' | 'CANCELLED' }) {
    return this.institutions.setStatus(id, body.status);
  }
}

/** The signed-in user's own institution. */
@ApiTags('Institution')
@ApiHeader({ name: 'X-Institution-Id', required: false, description: 'Super Admin only: the institution to act on' })
@Controller('institution')
export class InstitutionController {
  constructor(private readonly institutions: InstitutionsService) {}

  @Get()
  @RequirePermission('institution.settings.read')
  get(@TenantId() institutionId: string) {
    return this.institutions.get(institutionId);
  }

  @Patch()
  @RequirePermission('institution.settings.update')
  update(@TenantId() institutionId: string, @Body({ schema: updateInstitutionSettingsSchema }) body: UpdateInstitutionSettingsInput) {
    return this.institutions.updateSettings(institutionId, body);
  }
}
