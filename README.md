# Glee Backend

NestJS backend for Glee. The active application lives under `src/` and uses
Prisma with PostgreSQL.

## Requirements

- Node.js 20.x
- npm
- Docker, for local PostgreSQL

## Setup

```bash
npm install
cp .env.example .env
docker compose up -d
npx prisma migrate deploy
npx prisma db seed
```

## Development

```bash
npm run start:dev
```

Swagger is served at `/swagger`. Versioned API routes are prefixed with
`/api/v1`.

## Verification

```bash
npm run build
npm test -- --runInBand
npx prisma validate
```

## Project Structure

```text
src/
  app.module.ts                 # active Nest module registry
  auth/
    jwt/                        # JWT strategy and global auth guard
    rbac/                       # permission decorator, enum, and guard
  common/                       # decorators, filters, interceptors, responses, logger, utilities
  infrastructure/
    database/                   # Prisma module/service
    email/                      # Resend email service and Handlebars views
    payments/paystack/          # Paystack integration code, not registered yet
    push/onesignal/             # OneSignal integration
    storage/                    # S3/file helpers
  modules/
    identity/users/             # user lookup, signup support, JWT payload building
    events/                     # events, event categories, shared event services
    tickets/                    # event ticket purchase and ticket helpers
    venues/locations/           # locations/venues
    notifications/notifications/# app notification routes and service
```

New feature modules should live under `src/modules/<domain>/<feature>/`.
Shared framework helpers belong in `src/common/`. External services and
adapters belong in `src/infrastructure/`. Keep `src/app.module.ts` as the
single source of truth for active runtime modules.

RBAC is centered in `src/auth/rbac/`. Roles are Prisma `UserRole` enum values
seeded from `prisma/seed.ts`; permission strings are defined in
`src/auth/rbac/permissions.enum.ts` and enforced by the global
`PermissionsGuard`.

## Legacy Modules

Unregistered or schema-incompatible modules were moved to `legacy/` so the
active Nest app compiles against the current Prisma schema. Restore modules
from there only after their Prisma models, module imports, and tests are
updated together.
