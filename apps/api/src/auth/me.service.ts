import { Injectable, UnauthorizedException } from '@nestjs/common';
import type { Me } from '@edumanage/shared';
import { PrismaService } from '../prisma/prisma.service.js';
import { PrincipalService } from './principal.service.js';

@Injectable()
export class MeService {
  constructor(
    private readonly prisma: PrismaService,
    private readonly principals: PrincipalService,
  ) {}

  async canSignIn(userId: string): Promise<boolean> {
    return (await this.principals.load(userId)) !== null;
  }

  async build(userId: string): Promise<Me> {
    const principal = await this.principals.load(userId);
    if (!principal) {
      throw new UnauthorizedException();
    }
    const institution = principal.institutionId
      ? await this.prisma.institution.findUnique({
          where: { id: principal.institutionId },
          select: { id: true, name: true, slug: true, type: true },
        })
      : null;
    return {
      id: principal.id,
      email: principal.email,
      fullName: principal.fullName,
      isPlatformAdmin: principal.isPlatformAdmin,
      institution,
      roles: principal.roles,
      permissions: principal.permissions,
    };
  }
}
