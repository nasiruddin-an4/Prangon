import { Injectable } from '@nestjs/common';
import { PasswordHasher } from '@nestjs/authentication';
import { PrismaService } from '../prisma/prisma.service.js';

@Injectable()
export class CredentialsService {
  constructor(
    private readonly prisma: PrismaService,
    private readonly passwordHasher: PasswordHasher,
  ) {}

  hash(password: string) {
    return this.passwordHasher.hash(password);
  }

  /**
   * The user id, or `null` when the institution, email or password is wrong.
   * An unknown account still costs a full hash check (`verify()` against a
   * dummy hash), so response time doesn't reveal which emails exist.
   */
  async verify(institutionSlug: string | undefined, email: string, password: string): Promise<string | null> {
    const user = await this.prisma.user.findFirst({
      where: institutionSlug
        ? { email, institution: { slug: institutionSlug }, isPlatformAdmin: false }
        : { email, institutionId: null, isPlatformAdmin: true },
      select: { id: true, passwordHash: true },
    });
    const valid = await this.passwordHasher.verify(password, user?.passwordHash);
    if (!valid || !user?.passwordHash) {
      return null;
    }
    if (this.passwordHasher.needsRehash(user.passwordHash)) {
      await this.prisma.user.update({ where: { id: user.id }, data: { passwordHash: await this.hash(password) } });
    }
    return user.id;
  }

  async verifyById(userId: string, password: string): Promise<boolean> {
    const user = await this.prisma.user.findUnique({ where: { id: userId }, select: { passwordHash: true } });
    return this.passwordHasher.verify(password, user?.passwordHash);
  }
}
