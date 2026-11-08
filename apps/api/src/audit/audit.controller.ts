import { Controller, Get, Query } from '@nestjs/common';
import { ApiTags } from '@nestjs/swagger';
import { paginationSchema, type PaginationInput } from '@edumanage/shared';
import { RequirePermission } from '../auth/access.policy.js';
import { TenantId } from '../common/tenant.decorator.js';
import { AuditService } from './audit.service.js';

@ApiTags('Audit')
@Controller('audit-logs')
export class AuditController {
  constructor(private readonly audit: AuditService) {}

  @Get()
  @RequirePermission('audit.read')
  list(@TenantId() institutionId: string, @Query({ schema: paginationSchema }) query: PaginationInput) {
    return this.audit.list(institutionId, query);
  }
}
