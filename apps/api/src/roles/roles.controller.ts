import { Body, Controller, Delete, Get, HttpCode, Param, ParseUUIDPipe, Patch, Post } from '@nestjs/common';
import { CurrentUser } from '@nestjs/authentication';
import { ApiTags } from '@nestjs/swagger';
import { createRoleSchema, updateRoleSchema, type CreateRoleInput, type UpdateRoleInput } from '@edumanage/shared';
import { RequireAnyPermission, RequirePermission } from '../auth/access.policy.js';
import type { AuthUser } from '../auth/auth-user.js';
import { TenantId } from '../common/tenant.decorator.js';
import { RolesService } from './roles.service.js';

@ApiTags('Roles & permissions')
@Controller()
export class RolesController {
  constructor(private readonly roles: RolesService) {}

  @Get('permissions')
  @RequireAnyPermission('roles.read', 'users.manage')
  catalog() {
    return this.roles.catalog();
  }

  @Get('roles')
  @RequireAnyPermission('roles.read', 'users.manage')
  list(@TenantId() institutionId: string) {
    return this.roles.list(institutionId);
  }

  @Post('roles')
  @RequirePermission('roles.manage')
  create(@TenantId() institutionId: string, @CurrentUser() user: AuthUser, @Body({ schema: createRoleSchema }) body: CreateRoleInput) {
    return this.roles.create(institutionId, user, body);
  }

  @Patch('roles/:id')
  @RequirePermission('roles.manage')
  update(
    @TenantId() institutionId: string,
    @CurrentUser() user: AuthUser,
    @Param('id', ParseUUIDPipe) id: string,
    @Body({ schema: updateRoleSchema }) body: UpdateRoleInput,
  ) {
    return this.roles.update(institutionId, user, id, body);
  }

  @Delete('roles/:id')
  @HttpCode(204)
  @RequirePermission('roles.manage')
  remove(@TenantId() institutionId: string, @Param('id', ParseUUIDPipe) id: string) {
    return this.roles.remove(institutionId, id);
  }
}
