import { Body, Controller, Get, Param, ParseUUIDPipe, Patch, Post } from '@nestjs/common';
import { CurrentUser } from '@nestjs/authentication';
import { ApiTags } from '@nestjs/swagger';
import { createCampusSchema, updateCampusSchema, type CreateCampusInput, type UpdateCampusInput } from '@edumanage/shared';
import { RequirePermission } from '../auth/access.policy.js';
import type { AuthUser } from '../auth/auth-user.js';
import { TenantId } from '../common/tenant.decorator.js';
import { CampusesService } from './campuses.service.js';

@ApiTags('Campuses')
@Controller('campuses')
export class CampusesController {
  constructor(private readonly campuses: CampusesService) {}

  @Get()
  @RequirePermission('campuses.read')
  list(@TenantId() institutionId: string, @CurrentUser() user: AuthUser) {
    return this.campuses.list(institutionId, user);
  }

  @Get(':id')
  @RequirePermission('campuses.read')
  get(@TenantId() institutionId: string, @Param('id', ParseUUIDPipe) id: string) {
    return this.campuses.get(institutionId, id);
  }

  @Post()
  @RequirePermission('campuses.manage')
  create(@TenantId() institutionId: string, @Body({ schema: createCampusSchema }) body: CreateCampusInput) {
    return this.campuses.create(institutionId, body);
  }

  @Patch(':id')
  @RequirePermission('campuses.manage')
  update(
    @TenantId() institutionId: string,
    @Param('id', ParseUUIDPipe) id: string,
    @Body({ schema: updateCampusSchema }) body: UpdateCampusInput,
  ) {
    return this.campuses.update(institutionId, id, body);
  }
}
