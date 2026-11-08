import { AuthenticationStorage } from '@nestjs/authentication';
import { authenticationStoreContract } from '@nestjs/authentication/testing';
import { PrismaAuthStore } from '../src/auth/prisma-auth.store.js';
import { PrismaService } from '../src/prisma/prisma.service.js';

/**
 * The package's own contract suite, including the races (parallel refreshes
 * of one token, sign-out racing a request, …), against real Postgres.
 * Ids are unique per case, so it runs on the development database.
 */
describe('PrismaAuthStore (contract, Postgres)', () => {
  const prisma = new PrismaService();
  afterAll(() => prisma.$disconnect());

  const cases = authenticationStoreContract(
    () => {
      const store = new PrismaAuthStore(prisma, new AuthenticationStorage());
      return { sessions: store, refreshTokens: store };
    },
    { contracts: ['sessions', 'refreshTokens'], concurrent: true },
  );

  for (const c of cases) {
    it(c.name, c.run);
  }
});
