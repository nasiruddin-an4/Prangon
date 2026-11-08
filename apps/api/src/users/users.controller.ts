import { Body, Controller, Get, Param, ParseUUIDPipe, Patch, Post, Query } from '@nestjs/common';
import { CurrentUser } from '@nestjs/authentication';
import { ApiTags } from '@nestjs/swagger';
import {
  createUserSchema,
  paginationSchema,
  updateUserSchema,
  type CreateUserInput,
  type PaginationInput,
  type UpdateUserInput,
} from '@edumanage/shared';
import { RequirePermission } from '../auth/access.policy.js';
import type { AuthUser } from '../auth/auth-user.js';
import { TenantId } from '../common/tenant.decorator.js';
import { UsersService } from './users.service.js';

@ApiTags('Users')
@Controller('users')
export class UsersController {
  constructor(private readonly users: UsersService) {}

  @Get()
  @RequirePermission('users.read')
  list(@TenantId() institutionId: string, @Query({ schema: paginationSchema }) query: PaginationInput) {
    return this.users.list(institutionId, query);
  }

  @Get(':id')
  @RequirePermission('users.read')
  get(@TenantId() institutionId: string, @Param('id', ParseUUIDPipe) id: string) {
    return this.users.get(institutionId, id);
  }

  @Post()
  @RequirePermission('users.manage')
  create(@TenantId() institutionId: string, @CurrentUser() user: AuthUser, @Body({ schema: createUserSchema }) body: CreateUserInput) {
    return this.users.create(institutionId, user, body);
  }

  @Patch(':id')
  @RequirePermission('users.manage')
  update(
    @TenantId() institutionId: string,
    @CurrentUser() user: AuthUser,
    @Param('id', ParseUUIDPipe) id: string,
    @Body({ schema: updateUserSchema }) body: UpdateUserInput,
  ) {
    return this.users.update(institutionId, user, id, body);
  }
}
