#!/usr/bin/env bash
set -euo pipefail

export DATABASE_URL="${DATABASE_URL:-postgresql://glee_ci:glee_ci_password@localhost:54329/glee_ci}"
export NODE_ENV="${NODE_ENV:-test}"
export SECRETKEY="${SECRETKEY:-ci-secret-key}"
export EXPIRESIN="${EXPIRESIN:-1d}"

pnpm exec prisma generate
pnpm exec prisma validate
pnpm exec prisma migrate deploy
pnpm test --runInBand
pnpm build
