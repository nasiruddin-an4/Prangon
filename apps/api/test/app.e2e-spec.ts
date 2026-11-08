import type { INestApplication } from '@nestjs/common';
import { VersioningType } from '@nestjs/common';
import { Test } from '@nestjs/testing';
import request from 'supertest';
import type { App } from 'supertest/types.js';
import { AppModule } from '../src/app.module.js';
import { PrismaService } from '../src/prisma/prisma.service.js';

/**
 * End-to-end checks of tenancy and access control against the seeded
 * development database (`pnpm db:seed`). Creates a throwaway institution.
 */
const password = process.env.SEED_SUPERADMIN_PASSWORD!;
const suffix = Date.now().toString(36);

describe('EduManage API (e2e)', () => {
  let app: INestApplication<App>;
  const http = () => request(app.getHttpServer());
  const token = async (body: object) => {
    const res = await http().post('/api/v1/auth/token').send(body).expect(200);
    return res.body.accessToken as string;
  };

  beforeAll(async () => {
    const moduleRef = await Test.createTestingModule({ imports: [AppModule] }).compile();
    app = moduleRef.createNestApplication();
    app.setGlobalPrefix('api');
    app.enableVersioning({ type: VersioningType.URI, defaultVersion: '1' });
    await app.init();
  });

  // Remove the throwaway institution so test runs don't pile up in the dev database.
  afterAll(async () => {
    const prisma = app.get(PrismaService);
    const institution = await prisma.institution.findUnique({ where: { slug: `e2e-${suffix}` }, include: { users: true } });
    if (institution) {
      const userIds = institution.users.map((u) => u.id);
      await prisma.$transaction([
        prisma.authSession.deleteMany({ where: { userId: { in: userIds } } }),
        prisma.refreshToken.deleteMany({ where: { userId: { in: userIds } } }),
        prisma.user.deleteMany({ where: { institutionId: institution.id } }),
        prisma.campus.deleteMany({ where: { institutionId: institution.id } }),
        prisma.institution.delete({ where: { id: institution.id } }),
      ]);
    }
    await app.close();
  });

  it('reports health without credentials', () => http().get('/api/v1/health').expect(200));

  it('requires credentials everywhere else', () => http().get('/api/v1/campuses').expect(401));

  it('rejects a wrong password without saying which field was wrong', async () => {
    const res = await http()
      .post('/api/v1/auth/token')
      .send({ institution: 'demo-university', email: 'admin@demo.edu.bd', password: 'wrong-password' })
      .expect(401);
    expect(res.body.message).toBe('Invalid institution, email or password');
  });

  it('keeps institutions isolated and blocks privilege escalation', async () => {
    const superAdmin = await token({ email: process.env.SEED_SUPERADMIN_EMAIL, password });
    const slug = `e2e-${suffix}`;
    await http()
      .post('/api/v1/platform/institutions')
      .set('authorization', `Bearer ${superAdmin}`)
      .send({
        name: `E2E University ${suffix}`,
        slug,
        admin: { fullName: 'E2E Admin', email: `admin@${slug}.test`, password },
        mainCampus: { name: 'Main', code: 'MAIN' },
      })
      .expect(201);

    const otherAdmin = await token({ institution: slug, email: `admin@${slug}.test`, password });
    const demoAdmin = await token({ institution: 'demo-university', email: 'admin@demo.edu.bd', password });

    // A demo campus id is invisible to the other institution, even when it spoofs the tenant header.
    const demoCampuses = await http().get('/api/v1/campuses').set('authorization', `Bearer ${demoAdmin}`).expect(200);
    const demoInstitution = await http().get('/api/v1/institution').set('authorization', `Bearer ${demoAdmin}`).expect(200);
    await http().get(`/api/v1/campuses/${demoCampuses.body[0].id}`).set('authorization', `Bearer ${otherAdmin}`).expect(404);
    const spoofed = await http()
      .get('/api/v1/campuses')
      .set('authorization', `Bearer ${otherAdmin}`)
      .set('x-institution-id', demoInstitution.body.id)
      .expect(200);
    expect(spoofed.body.map((c: { code: string }) => c.code)).toEqual(['MAIN']);

    // Tenant admins cannot reach platform routes.
    await http().get('/api/v1/platform/institutions').set('authorization', `Bearer ${otherAdmin}`).expect(403);

    // A Campus Admin (users.manage, but not everything) cannot hand out Institution Admin.
    const roles = await http().get('/api/v1/roles').set('authorization', `Bearer ${otherAdmin}`).expect(200);
    const roleId = (key: string) => roles.body.find((r: { key: string }) => r.key === key).id;
    await http()
      .post('/api/v1/users')
      .set('authorization', `Bearer ${otherAdmin}`)
      .send({ fullName: 'Campus Admin', email: `campus@${slug}.test`, password, roles: [{ roleId: roleId('campus_admin') }] })
      .expect(201);
    const campusAdmin = await token({ institution: slug, email: `campus@${slug}.test`, password });
    await http()
      .post('/api/v1/users')
      .set('authorization', `Bearer ${campusAdmin}`)
      .send({ fullName: 'Sneaky', email: `sneaky@${slug}.test`, password, roles: [{ roleId: roleId('institution_admin') }] })
      .expect(403);

    // Portal roles reach only the holder's own records, so a user manager may
    // create student logins even without holding portal.student themselves...
    await http()
      .post('/api/v1/users')
      .set('authorization', `Bearer ${campusAdmin}`)
      .send({ fullName: 'Portal Student', email: `26cse0001@${slug}.test`, password, roles: [{ roleId: roleId('student') }] })
      .expect(201);
    const student = await token({ institution: slug, email: `26cse0001@${slug}.test`, password });
    const me = await http().get('/api/v1/auth/me').set('authorization', `Bearer ${student}`).expect(200);
    expect(me.body.permissions).toEqual(['portal.student']);
    // ...and the student gets nothing beyond the portal.
    await http().get('/api/v1/users').set('authorization', `Bearer ${student}`).expect(403);
    await http().get('/api/v1/campuses').set('authorization', `Bearer ${student}`).expect(403);
    // A role mixing portal and staff permissions is still checked for the staff part.
    await http()
      .post('/api/v1/users')
      .set('authorization', `Bearer ${campusAdmin}`)
      .send({ fullName: 'Mixed', email: `mixed@${slug}.test`, password, roles: [{ roleId: roleId('student') }, { roleId: roleId('accountant') }] })
      .expect(403);

    // Suspending the institution cuts its users off immediately.
    const list = await http().get(`/api/v1/platform/institutions?search=${slug}`).set('authorization', `Bearer ${superAdmin}`).expect(200);
    await http()
      .patch(`/api/v1/platform/institutions/${list.body.items[0].id}/status`)
      .set('authorization', `Bearer ${superAdmin}`)
      .send({ status: 'SUSPENDED' })
      .expect(200);
    await http().get('/api/v1/campuses').set('authorization', `Bearer ${otherAdmin}`).expect(401);
  });
});
