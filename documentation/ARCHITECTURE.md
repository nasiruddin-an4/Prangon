# EduManage architecture

Decisions made on 2026-11-08: **university-first**, **multi-institution SaaS**, **web + mobile + public API**, **Next.js + NestJS + PostgreSQL**.

## Multi-tenancy

One database, shared tables, and every tenant-owned row carries `institution_id`.

- The `@TenantId()` decorator ([apps/api/src/common/tenant.decorator.ts](../apps/api/src/common/tenant.decorator.ts)) resolves the institution a request acts on. Tenant users always get their own institution, and any `X-Institution-Id` header they send is ignored. Platform Super Admins choose a tenant with that header.
- Every tenant service method takes `institutionId` and filters by it. A record from another tenant returns **404**, not 403, so its existence isn't revealed.
- Suspending or cancelling an institution blocks its users on their next request, because the principal is reloaded on every request.
- Next step (Phase 7): add Postgres Row-Level Security as a second layer.

## Authentication ([apps/api/src/auth](../apps/api/src/auth))

Built on `@nestjs/authentication`. Its global guard makes every route require sign-in unless the route is marked `@Public()`.

| Provider | Order | Used by |
| --- | --- | --- |
| `SessionAuth` (session cookie) | 0 | Web app |
| `JwtAuth` (HS256, 15 min, `aud=edumanage-api`) | 1 | Mobile app |
| `ApiKeyAuth` (`edm_<id>_<secret>`) | 2 | Integrations; can never manage keys |

- Passwords are hashed with scrypt at OWASP parameters, using no native dependency. An unknown email takes the same time as a wrong password.
- Sessions and refresh tokens live in Postgres (`PrismaAuthStore`) and are stored only as SHA-256 hashes. The store passes the package's own contract suite, including the race-condition cases (`test/auth-store.e2e-spec.ts`).
- Reusing a refresh token revokes its whole token family.
- Rate limits are designed for campus networks, where many people share one IP ([common/throttler.guard.ts](../apps/api/src/common/throttler.guard.ts)). General traffic is counted per session, token or API key (600/min), with a 3,000/min ceiling per IP. Sign-in allows 10/min for one email from one IP and 120/min per IP.
- Cross-origin writes are refused (`enableCsrfProtection`, plus the session cookie's `SameSite=Lax`).
- Every sign-in, password change and admin action is written to `audit_logs`.

## Authorization (RBAC)

- [`packages/shared/src/permissions.ts`](../packages/shared/src/permissions.ts) is the permission catalog. It covers all modules, including future phases, so institutions can configure roles once. It seeds the `permissions` table.
- Each new institution starts with 12 default roles ([roles.ts](../packages/shared/src/roles.ts)): Institution Admin, Campus Admin, Director, Registrar, Admission Officer, Department Head, Teacher, Accountant, Librarian, HR, Student and Guardian. Their permissions can be edited, but the roles can't be deleted.
- A role assignment can be limited to one campus (`user_roles.campus_id`).
- Routes declare `@RequirePermission('campuses.manage')`. `@nestjs/authorization` **denies by default**, so a route without a declaration is closed.
- **No privilege escalation:** users can't assign a role, or edit a role's permissions, beyond what they hold themselves. One deliberate exception: `portal.*` permissions only ever reach the holder's own records, so anyone with `users.manage` may create Student and Guardian logins ([users.service.ts](../apps/api/src/users/users.service.ts); covered by the e2e test). A role that mixes portal and staff permissions is still checked for the staff part.

## Web app ([apps/web](../apps/web))

- Every page is a static shell. Data loads client-side from the same `/api/v1` endpoints the mobile app will use. `next.config.ts` rewrites `/api/*` to the API, so the session cookie is first-party.
- `src/proxy.ts` redirects visitors without a session cookie to `/login`. This is an optimistic check only; the API enforces everything.
- The sidebar ([components/navigation.ts](../apps/web/src/components/navigation.ts)) is grouped as Overview → Students → Academic → People → Finance → Campus services → Communication → Reports → Administration. Daily work sits at the top and one-time setup (campuses, roles, settings) at the bottom. Each item shows only to roles holding its permission, so a Teacher sees roughly Dashboard, Students, Class routine, Attendance, Exams & marks, Results and Notices.

## Browser-storage modules (Phases 2–5 prototype)

These modules are fully working in the web app, but keep their data in **localStorage**:

- Admissions, Students and Guardians
- Class routine, Attendance, Exams & marks, Results & transcripts and Academic setup
- ID cards & certificates
- Teachers & staff and Leave
- Fees & payments, Scholarships, and Expenses & payroll
- Library, Transport and Hostel
- Notices and Reports

Each institution gets its own store, one database per institution (`edumanage:demo:<institutionId>`). This lets the workflows be checked end to end before the Postgres schema is fixed.

- [`lib/demo/types.ts`](../apps/web/src/lib/demo/types.ts) holds the record shapes, which mirror the planned Prisma models.
- [`lib/demo/logic.ts`](../apps/web/src/lib/demo/logic.ts) holds the business rules, with no React or storage code, so it can move into the Nest services as is:
  - student ID generation from the institution's format;
  - UGC grading and credit-weighted GPA;
  - attendance percentage, with the 75% exam threshold;
  - invoice totals and status;
  - routine clash detection (section, teacher, room);
  - Bangladeshi phone validation;
  - CSV import and export.
- [`lib/demo/seed.ts`](../apps/web/src/lib/demo/seed.ts) generates the same demo university in every browser:
  - faculties, departments, programs, courses and a clash-free routine;
  - about 60 students with guardians;
  - about a month of attendance;
  - marks;
  - invoices and payments (bKash, Nagad, cash, bank, card);
  - an admission intake.
- [`lib/demo/store.ts`](../apps/web/src/lib/demo/store.ts) is the only storage-aware file. Data saved by an older version is upgraded in place by `migrateDemoDb` in `seed.ts`, so testers keep their changes when new collections are added. Pages call `useDemo()` → `{ db, update, reset }`. Every page shows a "Demo data, saved in this browser · Reset" notice.
- The permission catalog has no dedicated keys for leave, transport, hostel or payroll yet, so these modules reuse existing ones:
  - Leave: anyone can open it; deciding needs `teachers.manage` (employees) or `students.manage` (students).
  - Student affairs: `students.read` to view, `students.manage` to act. Clearance: each office's own permission (`finance.collect`, `library.manage`, `students.manage`, `academics.manage`).
  - Transport and Hostel: `students.read` to view, `students.manage` to change.
  - Expenses & payroll: `finance.manage`.
  - Library: `library.manage`.
  - ID cards & certificates: `students.manage`.

  Give them their own keys when these modules move to the API.
- Campuses, users, roles, settings (including the student ID format) and the permission checks are still real API data. The UI hides actions a role doesn't hold, but nothing is enforced server-side until the modules move to the API.

## Student portal

Students sign in with the normal login (institution code + official email + password) and see only their own records under `/portal`:

- dashboard, profile (with correction requests) and digital ID card;
- courses and weekly routine;
- attendance, and leave applications;
- exam schedule, admit card (only when eligible) and results (grades only after publication);
- invoices, online payment and receipts;
- borrowed books and fines;
- certificate requests, complaints and support, and clearance status;
- notices.

- **Logins:** staff with `users.manage` click **Create portal login** on a student's profile. This creates a real API user with the Student role and an official email such as `26cse0001@student.<institution-code>.edu.bd`, and shows a one-time password.
- **Routing:** a user holding only `portal.*` permissions gets the portal sidebar and is sent from `/` to `/portal` (`isPortalOnly`). Staff pages show "You don't have access", and the API returns 403 for every staff endpoint.
- **Staff preview:** staff with `students.read` see the same pages through **Student portal preview**, with a picker to choose which student.
- **Demo limitation:** the portal finds the student by matching the sign-in email against the browser-stored record. On another browser or computer the demo data starts fresh and the account isn't linked yet. This goes away when students move to Postgres, where `users` links to `students` by ID and the API resolves "me" from the session, never from a client-supplied ID.

## Cross-office workflows ([lib/demo/workflows.ts](../apps/web/src/lib/demo/workflows.ts))

One office never edits another office's records. It raises a charge or a request, and the owning office acts on it. Each step is recorded with who did it and when.

| Workflow | Path |
| --- | --- |
| Library fine | Library returns a late book → raises a **FINE** charge on the student's account → Accounts collects it, or the student pays online → Library history shows it as paid. Teachers and staff pay at the desk. |
| Certificate | Student requests → Registrar verifies the record (`students.manage`) → a ৳300 **CERTIFICATE** charge goes to Accounts → once paid, the Document office issues a numbered certificate → the student prints it from the portal. |
| Exam eligibility | The Exam office's admit-card list combines the department's attendance (75%) and Accounts' dues (nothing overdue). Ineligible students see why in their portal. |
| Attendance correction | Submitted attendance is locked for teachers. They send a correction request, and the department (`academics.manage`) approves it. Every change after submission is kept in the sheet's `edits` trail with a reason. |
| Clearance | Graduation, withdrawal or transfer. Accounts, Library, Hostel, Transport and Department each sign off only when their own check passes. The Registrar's final approval changes the student's status. |
| Student Affairs | Portal complaints become tickets: Submitted → Assigned → Under review → Resolved → Closed. Harassment and ragging tickets are always confidential (details hidden from staff without `students.manage`). Record corrections arrive the same way. |

Not built yet from the university operations spec:

- notice approval workflow, and notice targeting by department, program or batch;
- course registration;
- assignments and course materials;
- the guardian portal;
- refunds;
- lost-book handling;
- meal management;
- research, alumni, career and medical offices.

**Moving a module to Postgres:**

1. Add its Prisma models, following `types.ts`.
2. Port its rules from `logic.ts` into a Nest service.
3. Swap `useDemo()` reads for `useApi()`, and `update()` for `api()` calls.

The pages' markup doesn't change.

## Adding a module (pattern for Phases 2–6)

1. Add Prisma models with `institutionId` and `@@index([institutionId])`. Store money as `Decimal @db.Decimal(14,2)`. Run `pnpm db:migrate`.
2. Add Zod schemas to `packages/shared/src/schemas.ts`, then rebuild shared.
3. Add a Nest module: a controller using `@TenantId()`, `@RequirePermission(...)` and `@Body({ schema })`, and a service that filters every query by `institutionId` and calls `audit.record(...)` for changes. Use `prisma.$transaction` for enrollment, fee collection and result publishing.
4. Add an e2e test that proves cross-tenant access returns 404.
5. Add a web page and unlock its sidebar entry in `components/navigation.ts`.

## Roadmap status

| Phase | Scope | Status |
| --- | --- | --- |
| 1 Foundation | Monorepo, DB, auth (web/mobile/API keys), RBAC, institutions, campuses, users, roles, audit, dashboard | **Done** |
| 2 Students & Admission | Students, guardians, applications, student ID generation, CSV import | UI done on browser storage; API next |
| 3 Academics | Faculties, departments, programs, courses, semesters, sections, routines | UI done on browser storage |
| 4 Attendance & Exams | Attendance, leave, exams, marks, GPA/CGPA, results | UI done on browser storage (no leave or multi-semester CGPA yet) |
| 5 Finance | Fee structures, invoices, payments (bKash/Nagad/SSLCommerz), scholarships | UI done on browser storage (payments are recorded manually; gateways not integrated) |
| 6 Portals & Notifications | Student/guardian portals, **mobile app (Expo)**, email/SMS | |
| 7 Hardening | MFA for privileged accounts, RLS, Redis-backed throttling, backups, deployment | |

### Known gaps carried from Phase 1

- **MFA** for privileged accounts isn't enabled yet. `@nestjs/authentication` supports TOTP, but it needs an `MfaStore`.
- Password reset and email verification aren't built yet; they need an SMTP or SMS provider.
- Rate-limit counters are kept in memory per process. Move them to Redis before running more than one API instance.
- The mobile app isn't scaffolded yet. The API side is ready: token endpoints, shared Zod schemas.
- Bangla UI translations are pending; the locale setting is already stored per institution.
