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

## Legacy Modules

Unregistered or schema-incompatible modules were moved to `legacy/` so the
active Nest app compiles against the current Prisma schema. Restore modules
from there only after their Prisma models, module imports, and tests are
updated together.
