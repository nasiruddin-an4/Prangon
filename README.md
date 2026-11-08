# Prangon

**Prangon** (প্রাঙ্গণ, "campus") is a university management platform: a multi-institution SaaS for universities in Bangladesh, built to grow into colleges, schools and training institutes.

**Status:** Phase 1 (auth, roles, institutions, campuses, users, audit) runs on the API and PostgreSQL. Every office module (admissions to hostel) and the student portal work in the web app on browser storage with demo data, ahead of their move to PostgreSQL. See [documentation/ARCHITECTURE.md](documentation/ARCHITECTURE.md).

| Path | What |
| --- | --- |
| `apps/api` | NestJS 12 REST API (`/api/v1`), Prisma 7, PostgreSQL |
| `apps/web` | Next.js 16 admin web app (talks to the API through `/api/*`) |
| `packages/shared` | Zod schemas, permission catalog, default roles, shared types — used by API, web and (later) mobile |
| `infrastructure/docker` | Postgres 17 + Redis 7 for local development |

## Run it locally

Requires Node 24+, pnpm, and Docker.

```bash
pnpm install
pnpm db:up                                   # Postgres on :5433, Redis on :6380
cp apps/api/.env.example apps/api/.env       # then set JWT_SECRET and SEED_SUPERADMIN_PASSWORD
cp apps/web/.env.example apps/web/.env.local
pnpm --filter @edumanage/shared build
pnpm db:migrate                              # apply migrations + generate the Prisma client
pnpm db:seed                                 # permissions, Super Admin, demo university
pnpm dev                                     # API on :4000, web on :3000
```

Open http://localhost:3000.

- **Institution sign-in:** institution code `demo-university`, `admin@demo.edu.bd`, password = `SEED_SUPERADMIN_PASSWORD`.
- **Platform sign-in:** leave the institution code empty and use `SEED_SUPERADMIN_EMAIL` / `SEED_SUPERADMIN_PASSWORD` (re-run `pnpm db:seed` after changing them).
- **API docs (Swagger):** http://localhost:4000/api/docs

## Tests

```bash
pnpm --filter api test        # unit tests
pnpm --filter api test:e2e    # API + auth-store contract tests (needs the seeded database)
```

## Clients

| Client | Authenticates with |
| --- | --- |
| Web app | `POST /api/v1/auth/sign-in` → HttpOnly `__Host-sid` session cookie |
| Mobile app | `POST /api/v1/auth/token` → 15-min JWT + rotating refresh token (`/auth/token/refresh`) |
| Integrations (public API) | `Authorization: Bearer edm_…` API key, created under Settings → API Keys |
