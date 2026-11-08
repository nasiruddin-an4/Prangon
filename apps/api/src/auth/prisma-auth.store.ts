import { Injectable } from '@nestjs/common';
import {
  AuthenticationStorage,
  type MfaState,
  type RefreshTokenRecord,
  type RefreshTokenStore,
  type SessionRecord,
  type SessionStore,
} from '@nestjs/authentication';
import type { Prisma } from '../generated/prisma/client.js';
import { PrismaService } from '../prisma/prisma.service.js';

/**
 * Keeps @nestjs/authentication's sessions and refresh tokens in Postgres.
 *
 * The rules come from the package's store contract: whatever decides that
 * something works only once is a single conditional statement (`updateMany` /
 * `deleteMany` with the condition in `where`, judged by `count`), never a read
 * followed by a write. Optional fields come back `undefined`, never `null`.
 */
@Injectable()
export class PrismaAuthStore implements SessionStore, RefreshTokenStore {
  constructor(
    private readonly prisma: PrismaService,
    storage: AuthenticationStorage,
  ) {
    storage.registerSource({ sessions: this, refreshTokens: this });
  }

  // ── Sessions ──────────────────────────────────────────────────────────────

  async getSession(id: string): Promise<SessionRecord | undefined> {
    const row = await this.prisma.authSession.findUnique({ where: { id } });
    if (!row) {
      return undefined;
    }
    return {
      id: row.id,
      userId: row.userId,
      createdAt: row.createdAt,
      expiresAt: row.expiresAt,
      lastActiveAt: row.lastActiveAt,
      mfa: (row.mfa as MfaState | null) ?? undefined,
      metadata: (row.metadata as Record<string, unknown> | null) ?? undefined,
    };
  }

  async createSession(record: SessionRecord): Promise<void> {
    // Keep the table bounded: drop sessions past their absolute expiry.
    await this.prisma.authSession.deleteMany({ where: { expiresAt: { lt: record.createdAt } } });
    await this.prisma.authSession.create({
      data: {
        id: record.id,
        userId: record.userId,
        createdAt: record.createdAt,
        expiresAt: record.expiresAt,
        lastActiveAt: record.lastActiveAt,
        mfa: record.mfa ?? null,
        metadata: (record.metadata as Prisma.InputJsonValue | undefined) ?? undefined,
      },
    });
  }

  async touchSession(id: string, lastActiveAt: Date): Promise<void> {
    // Conditional: never resurrects a deleted session, only moves forward.
    await this.prisma.authSession.updateMany({
      where: { id, lastActiveAt: { lt: lastActiveAt } },
      data: { lastActiveAt },
    });
  }

  async deleteSession(id: string): Promise<boolean> {
    const { count } = await this.prisma.authSession.deleteMany({ where: { id } });
    return count > 0;
  }

  async listUserSessions(userId: string): Promise<SessionRecord[]> {
    const rows = await this.prisma.authSession.findMany({ where: { userId } });
    return rows.map((row) => ({
      id: row.id,
      userId: row.userId,
      createdAt: row.createdAt,
      expiresAt: row.expiresAt,
      lastActiveAt: row.lastActiveAt,
      mfa: (row.mfa as MfaState | null) ?? undefined,
      metadata: (row.metadata as Record<string, unknown> | null) ?? undefined,
    }));
  }

  async deleteUserSessions(userId: string): Promise<void> {
    await this.prisma.authSession.deleteMany({ where: { userId } });
  }

  // ── Refresh tokens ────────────────────────────────────────────────────────

  async getRefreshToken(id: string): Promise<RefreshTokenRecord | undefined> {
    const row = await this.prisma.refreshToken.findUnique({ where: { id } });
    if (!row) {
      return undefined;
    }
    return {
      id: row.id,
      familyId: row.familyId,
      userId: row.userId,
      createdAt: row.createdAt,
      expiresAt: row.expiresAt,
      familyExpiresAt: row.familyExpiresAt,
      usedAt: row.usedAt ?? undefined,
      claims: (row.claims as Record<string, unknown> | null) ?? undefined,
    };
  }

  async saveRefreshToken(record: RefreshTokenRecord): Promise<void> {
    await this.prisma.refreshToken.deleteMany({ where: { familyExpiresAt: { lt: record.createdAt } } });
    await this.prisma.refreshToken.create({
      data: {
        id: record.id,
        familyId: record.familyId,
        userId: record.userId,
        createdAt: record.createdAt,
        expiresAt: record.expiresAt,
        familyExpiresAt: record.familyExpiresAt,
        usedAt: record.usedAt ?? null,
        claims: (record.claims as Prisma.InputJsonValue | undefined) ?? undefined,
      },
    });
  }

  async markRefreshTokenUsed(id: string, at: Date): Promise<boolean> {
    const { count } = await this.prisma.refreshToken.updateMany({
      where: { id, usedAt: null },
      data: { usedAt: at },
    });
    return count > 0;
  }

  async revokeRefreshTokenFamily(familyId: string): Promise<void> {
    await this.prisma.refreshToken.updateMany({ where: { familyId }, data: { revoked: true } });
  }

  async isRefreshTokenFamilyRevoked(familyId: string): Promise<boolean> {
    // Any revoked token revokes the family, which covers successors saved later.
    const revoked = await this.prisma.refreshToken.count({ where: { familyId, revoked: true } });
    return revoked > 0;
  }

  async revokeUserRefreshTokens(userId: string): Promise<void> {
    await this.prisma.refreshToken.updateMany({ where: { userId }, data: { revoked: true } });
  }
}
