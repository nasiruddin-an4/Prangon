/**
 * Idempotent seed: the permission catalog, the first platform Super Admin, and
 * (outside production) a demo university to click around in.
 *
 *   pnpm db:seed
 */
import 'dotenv/config';
import { PasswordHasher } from '@nestjs/authentication';
import { PrismaPg } from '@prisma/adapter-pg';
import { PERMISSION_CATALOG, type Permission } from '@edumanage/shared';
import { PrismaClient } from '../src/generated/prisma/client.js';
import { provisionInstitution } from '../src/institutions/provisioning.js';

const prisma = new PrismaClient({ adapter: new PrismaPg({ connectionString: process.env.DATABASE_URL! }) });
const hasher = new PasswordHasher();

async function main() {
  // 1. Permission catalog (rows referenced by role_permissions).
  for (const [key, { module, label }] of Object.entries(PERMISSION_CATALOG) as [Permission, { module: string; label: string }][]) {
    await prisma.permission.upsert({ where: { key }, create: { key, module, description: label }, update: { module, description: label } });
  }
  console.log(`✔ ${Object.keys(PERMISSION_CATALOG).length} permissions`);

  // 2. Platform Super Admin.
  const email = (process.env.SEED_SUPERADMIN_EMAIL ?? 'superadmin@edumanage.local').toLowerCase();
  const password = process.env.SEED_SUPERADMIN_PASSWORD;
  if (!password || password.length < 10) {
    throw new Error('Set SEED_SUPERADMIN_PASSWORD (10+ characters) in apps/api/.env');
  }
  // Kept in sync with .env: a changed email renames the (single) existing
  // Super Admin, and a changed password replaces the old one.
  let admin = await prisma.user.findFirst({ where: { email, institutionId: null, isPlatformAdmin: true } });
  if (!admin) {
    const platformAdmins = await prisma.user.findMany({ where: { institutionId: null, isPlatformAdmin: true } });
    if (platformAdmins.length === 1) {
      admin = await prisma.user.update({ where: { id: platformAdmins[0].id }, data: { email } });
      console.log(`✔ Super Admin renamed ${platformAdmins[0].email} → ${email}`);
    } else if (platformAdmins.length > 1) {
      throw new Error(`Several Super Admins exist and none is ${email}; rename one by hand.`);
    }
  }
  if (!admin) {
    await prisma.user.create({
      data: { email, fullName: 'Platform Super Admin', passwordHash: await hasher.hash(password), isPlatformAdmin: true, emailVerified: true },
    });
    console.log(`✔ Super Admin ${email} created`);
  } else if (!(await hasher.verify(password, admin.passwordHash))) {
    await prisma.user.update({ where: { id: admin.id }, data: { passwordHash: await hasher.hash(password) } });
    // Whoever knew the old password must sign in again.
    await prisma.authSession.deleteMany({ where: { userId: admin.id } });
    await prisma.refreshToken.updateMany({ where: { userId: admin.id }, data: { revoked: true } });
    console.log(`✔ Super Admin ${email} password updated (old sessions signed out)`);
  } else {
    console.log(`• Super Admin ${email} is up to date`);
  }

  // 3. Demo tenant (development only).
  if (process.env.NODE_ENV !== 'production' && !(await prisma.institution.findUnique({ where: { slug: 'demo-university' } }))) {
    await prisma.$transaction(async (tx) => {
      const { institution } = await provisionInstitution(
        tx,
        {
          name: 'Demo University of Science & Technology',
          shortName: 'DUST',
          slug: 'demo-university',
          type: 'UNIVERSITY',
          admin: { fullName: 'Demo Admin', email: 'admin@demo.edu.bd', password },
          mainCampus: { name: 'Main Campus, Dhaka', code: 'DHK' },
        },
        await hasher.hash(password),
      );
      await tx.institution.update({ where: { id: institution.id }, data: { status: 'ACTIVE' } });
      await tx.campus.create({ data: { institutionId: institution.id, name: 'Chattogram Campus', code: 'CTG', division: 'Chattogram', district: 'Chattogram' } });
    });
    console.log('✔ Demo institution "demo-university" (admin@demo.edu.bd, same password as the Super Admin)');
  }

  // Keep the demo admin's password equal to the Super Admin's (development only),
  // so a changed .env password works for both logins and the e2e tests.
  if (process.env.NODE_ENV !== 'production') {
    const demoAdmin = await prisma.user.findFirst({ where: { email: 'admin@demo.edu.bd', institution: { slug: 'demo-university' } } });
    if (demoAdmin && !(await hasher.verify(password, demoAdmin.passwordHash))) {
      await prisma.user.update({ where: { id: demoAdmin.id }, data: { passwordHash: await hasher.hash(password) } });
      await prisma.authSession.deleteMany({ where: { userId: demoAdmin.id } });
      await prisma.refreshToken.updateMany({ where: { userId: demoAdmin.id }, data: { revoked: true } });
      console.log('✔ Demo admin admin@demo.edu.bd password synced with SEED_SUPERADMIN_PASSWORD');
    }
  }
}

main()
  .catch((error) => {
    console.error(error);
    process.exitCode = 1;
  })
  .finally(() => prisma.$disconnect());
