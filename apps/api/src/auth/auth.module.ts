import { Global, Module } from '@nestjs/common';
import { AccessPolicy } from './access.policy.js';
import { AuthController } from './auth.controller.js';
import { CredentialsService } from './credentials.service.js';
import { MeService } from './me.service.js';
import { PrincipalService } from './principal.service.js';
import { PrismaAuthStore } from './prisma-auth.store.js';
import { ApiKeyAuth, JwtAuth, SessionAuth } from './providers.js';

@Global()
@Module({
  controllers: [AuthController],
  providers: [
    PrismaAuthStore,
    PrincipalService,
    SessionAuth,
    JwtAuth,
    ApiKeyAuth,
    CredentialsService,
    MeService,
    AccessPolicy,
  ],
  exports: [CredentialsService, PrincipalService, ApiKeyAuth],
})
export class AuthModule {}
