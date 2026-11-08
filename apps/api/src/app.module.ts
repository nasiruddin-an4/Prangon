import { Module } from '@nestjs/common';
import { APP_GUARD, APP_PIPE } from '@nestjs/core';
import { StandardSchemaValidationPipe } from '@nestjs/common';
import { ConfigModule } from '@nestjs/config';
import { AuthenticationModule } from '@nestjs/authentication';
import { AuthorizationModule } from '@nestjs/authorization';
import { ThrottlerModule } from '@nestjs/throttler';
import { env, validateEnv } from './config/env.js';
import { PrismaModule } from './prisma/prisma.module.js';
import { AuditModule } from './audit/audit.module.js';
import { AuthModule } from './auth/auth.module.js';
import { InstitutionsModule } from './institutions/institutions.module.js';
import { CampusesModule } from './campuses/campuses.module.js';
import { UsersModule } from './users/users.module.js';
import { RolesModule } from './roles/roles.module.js';
import { ApiKeysModule } from './api-keys/api-keys.module.js';
import { DashboardModule } from './dashboard/dashboard.module.js';
import { HealthController } from './health/health.controller.js';
import { CampusThrottlerGuard } from './common/throttler.guard.js';

@Module({
  imports: [
    ConfigModule.forRoot({ isGlobal: true, validate: validateEnv }),
    // Per credential (default) and per IP (ip); see CampusThrottlerGuard.
    ThrottlerModule.forRoot([
      { name: 'default', ttl: 60_000, limit: 600 },
      { name: 'ip', ttl: 60_000, limit: 3000 },
    ]),
    // Authentication must be imported before authorization: its guard sets the user.
    AuthenticationModule.forRootAsync({
      useFactory: () => {
        const config = env();
        return {
          session: {
            absoluteTtl: '14d',
            idleTtl: '2d',
            trustedOrigins: [config.WEB_ORIGIN],
            metadata: (request) => ({
              userAgent: request.headers['user-agent'] ?? null,
              ip: request.ip ?? null,
            }),
          },
          accessToken: {
            key: config.JWT_SECRET,
            issuer: config.JWT_ISSUER,
            audience: 'edumanage-api',
            ttl: '15m',
          },
          refreshToken: { ttl: '30d', absoluteTtl: '90d' },
        };
      },
    }),
    AuthorizationModule.forRoot(),
    PrismaModule,
    AuditModule,
    AuthModule,
    InstitutionsModule,
    CampusesModule,
    UsersModule,
    RolesModule,
    ApiKeysModule,
    DashboardModule,
  ],
  controllers: [HealthController],
  providers: [
    { provide: APP_PIPE, useClass: StandardSchemaValidationPipe },
    { provide: APP_GUARD, useClass: CampusThrottlerGuard },
  ],
})
export class AppModule {}
