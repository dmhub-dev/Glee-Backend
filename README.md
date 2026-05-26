# Glee Backend

NestJS API for the Glee event platform. It powers the public event site, customer ticket purchases, customer wallet, role-based dashboards, vendor operations, finance reporting, user management, RBAC, audit logs, notifications, and email flows.

The active backend app lives under `src/` and uses Prisma with PostgreSQL. Old or incompatible modules were moved to `legacy/` and are not part of the active runtime.

## Stack

- NestJS 8
- TypeScript
- Prisma 5
- PostgreSQL
- JWT auth
- Global RBAC permissions guard
- Handlebars email templates
- Resend email provider
- Paystack payments
- OneSignal push integration
- AWS S3 storage helpers
- Jest

## Requirements

- Node.js 20 is recommended
- npm
- Docker, if using local PostgreSQL from `docker-compose.yml`
- PostgreSQL 16 locally or a reachable remote database

## Quick Start

Install dependencies:

```bash
npm install
```

Create local environment file:

```bash
cp .env.example .env
```

Start local PostgreSQL:

```bash
docker compose up -d
```

Apply Prisma schema and seed data:

```bash
npx prisma migrate deploy
npx prisma db seed
```

Start the API:

```bash
npm run start:dev
```

Default local API:

```txt
http://localhost:8003
```

Swagger:

```txt
http://localhost:8003/swagger
```

Versioned routes use:

```txt
/api/v1
```

Some vendor-scoped admin event routes use:

```txt
/api/v2
```

## Scripts

```bash
npm run start
npm run start:dev
npm run start:debug
npm run build
npm run start:prod
npm run test
npm run test:watch
npm run test:cov
npm run test:e2e
npm run lint
npm run format
```

Common verification before handoff:

```bash
npm run build
npm test -- --runInBand
npx prisma validate
```

## Environment Variables

Main variables used by the active app:

```env
APP_NAME="Glee API"
NODE_ENV=development
PORT=8003
APP_URL=http://localhost:8003

SECRETKEY=your_jwt_secret
EXPIRESIN=1d

DATABASE_URL=postgresql://glee:glee@localhost:5432/glee

PAYSTACK_SECRET_KEY=sk_test_xxx
PAYSTACK_PUBLIC_KEY=pk_test_xxx
PAYSTACK_WEBHOOK_URL=http://localhost:8003/api/v1/paystack/webhook
PAYSTACK_CALLBACK_URL=http://localhost:8003/payment/callback

ONE_SIGNAL_APP_ID=
ONE_SIGNAL_API_KEY=

AWS_ACCESS_KEY_ID=
AWS_SECRET_ACCESS_KEY=
AWS_REGION=
AWS_S3_BUCKET=

RESEND_API_KEY=
RESEND_FROM=
```

Do not commit real production keys. Keep `.env.example` safe and placeholder-only.

## Project Structure

```txt
src/
  app.module.ts
  main.ts
  auth/
    dto/
    jwt/
    rbac/
  common/
    decorators/
    filters/
    interceptors/
    logger/
    responses/
    utils/
  config/
  infrastructure/
    database/
    email/
    payments/paystack/
    push/onesignal/
    storage/
  modules/
    events/
    finance/
    identity/
    notifications/
    tickets/
    venues/
    wallets/
  public/
  types/

prisma/
  schema.prisma
  seed.ts
  rbac-seed.ts

views/
  emails/

legacy/
```

## Active Runtime Modules

`src/app.module.ts` is the source of truth for active modules.

Currently registered:

```txt
PrismaModule
UsersModule
AuthModule
EventModule
EventTicketsModule
CategoriesModule
LocationModule
OnesignalModule
EmailModule
NotificationModule
AccessManagementModule
WalletModule
FinanceModule
```

Global providers:

- `JwtAuthGuard`: checks auth unless a route is marked public.
- `PermissionsGuard`: checks RBAC permissions.
- `HttpLogInterceptor`: logs API calls.
- `AllExceptionsFilter`: normalizes error responses.

## Auth

Auth routes are in:

```txt
src/auth/auth.controller.ts
src/auth/auth.service.ts
```

Important routes:

```txt
POST  /api/v1/register
POST  /api/v1/login
POST  /api/v1/login/verify-2fa
POST  /api/v1/refresh
GET   /api/v1/me
PATCH /api/v1/me
PATCH /api/v1/me/2fa
POST  /api/v1/me/password
POST  /api/v1/forgot-password
POST  /api/v1/verify-otp
POST  /api/v1/reset-password
```

Login can return a 2FA challenge if the account has `twoFactorEnabled = true`. The frontend then calls `/login/verify-2fa`.

Normal customer users use role:

```txt
USER
```

Operational roles use:

```txt
SUPER_ADMIN
ADMIN
OPERATIONS_MANAGER
COMMERCIAL_MANAGER
FINANCE
VENDOR
VENDOR_STAFF
CUSTOMER_SUPPORT
CONTENT_MANAGER
```

## RBAC

RBAC lives in:

```txt
src/auth/rbac/
```

Important files:

```txt
src/auth/rbac/permissions.enum.ts
src/auth/rbac/permissions.decorator.ts
src/auth/rbac/permissions.guard.ts
```

Permissions are attached to controller handlers:

```ts
@Permissions(Permission.EVENTS_CREATE)
```

The `PermissionsGuard` is registered globally, so routes must either:

- declare the required permissions, or
- be explicitly public with `@AllowAny()`.

Role and permission seed data is in:

```txt
prisma/seed.ts
prisma/rbac-seed.ts
```

## Database

Prisma schema:

```txt
prisma/schema.prisma
```

Important models:

```txt
Role
Permission
RolePermission
User
UserInvitation
AuditLog
Event
EventSchedule
EventMenuItem
TicketCategory
Location
Payment
EventTicket
Wallet
WalletTransaction
Notification
```

Validate schema:

```bash
npx prisma validate
```

Generate Prisma client:

```bash
npx prisma generate
```

Create a migration after schema changes:

```bash
npx prisma migrate dev --name describe_change
```

Apply migrations in deployed/local existing DBs:

```bash
npx prisma migrate deploy
```

<!-- Seed:

```bash
npx prisma db seed
```

## Seeded Test Accounts

`prisma/seed.ts` creates role test users.

Default password:

```txt
Test@1234
```

Common accounts:

```txt
super.admin@glee.test
admin.role@glee.test
operations.manager@glee.test
commercial.manager@glee.test
finance@glee.test
vendor@glee.test
vendor.staff@glee.test
customer.support@glee.test
content.manager@glee.test
user@glee.test
```

Also seeded:

```txt
admin@glee.com
Password: Admin@1234
```

If a seeded login fails, check that the user is not soft-deleted and is active:

```sql
select email, "isActive", "isDeleted" from "User" where email = 'user@glee.test'; -->
```

## Main API Areas

### Public Events

Files:

```txt
src/modules/events/event.controller.ts
src/modules/events/event.service.ts
```

Routes:

```txt
GET /api/v1/event
GET /api/v1/event/:id
GET /api/v1/event/nearby
GET /api/v1/event/participants
```

Public and customer event reads include event details, ticket categories, menu items, schedules, category, location, and vendor data where needed.

### Admin/Vendor Events

Files:

```txt
src/modules/events/admin.event.controller.ts
src/modules/events/event.service.ts
```

Routes:

```txt
POST   /api/v1/admin/event
PATCH  /api/v1/admin/event/:id
DELETE /api/v1/admin/event/:id
GET    /api/v1/admin/event/earning/:id
POST   /api/v1/admin/event/upload/images

POST   /api/v2/admin/event
PATCH  /api/v2/admin/event/:id
DELETE /api/v2/admin/event/:id
GET    /api/v2/admin/event/earning/:id
```

`/api/v2` is used for vendor-scoped event management. Vendors should only see and mutate their own data.

Event rules:

- Location comes from the `Location` table.
- Vendors can use admin/shared locations and their own private locations.
- Vendors cannot double-book the same location on the same day.
- Event statuses include `DRAFT`, `ACTIVE`, `POSTPONED`, `CANCELLED`, `SOLD_OUT`.
- `SOLD_OUT` should be automatic when tickets sell out.
- Create form should generally expose only `DRAFT` and `ACTIVE`.
- `POSTPONED` and `CANCELLED` are lifecycle updates after creation.

### Categories

Files:

```txt
src/modules/events/categories/
```

Routes:

```txt
GET    /api/v1/categories
GET    /api/v1/categories/:id
POST   /api/v1/admin/categories
PATCH  /api/v1/admin/categories/:id
DELETE /api/v1/admin/categories/:id
```

Vendors and users can read categories when permissions allow. Admin roles manage categories.

### Locations

Files:

```txt
src/modules/venues/locations/
```

Routes:

```txt
GET    /api/v1/locations
GET    /api/v1/locations/:id
GET    /api/v1/admin/locations
GET    /api/v1/admin/locations/:id
POST   /api/v1/admin/locations
PATCH  /api/v1/admin/locations/:id
POST   /api/v1/admin/locations/:id/pictures
DELETE /api/v1/admin/locations/:id
```

Location access rules:

- Super admin and admin can manage platform locations.
- Vendors can create and manage their own locations.
- Vendors can read platform locations plus their own locations.
- Vendor private locations are scoped by `vendorId`.

### Tickets

Files:

```txt
src/modules/tickets/
```

Customer/public routes:

```txt
POST /api/v1/event/tickets/purchase
POST /api/v1/event/tickets/initiate-guest
POST /api/v1/event/tickets/confirm-purchase
GET  /api/v1/event/tickets/my
GET  /api/v1/event/tickets/available
GET  /api/v1/event/tickets/:id
```

Admin/support routes:

```txt
GET    /api/v1/admin/event-ticket
GET    /api/v1/admin/event-ticket/:id
POST   /api/v1/admin/event-ticket/:id/support-note
PATCH  /api/v1/admin/event-ticket/:id/check-in
PATCH  /api/v1/admin/event-ticket/:id/check-in/revert
DELETE /api/v1/admin/event-ticket/:id
```

Ticket purchase supports:

- logged-in user wallet purchase
- logged-in user Paystack purchase
- guest Paystack purchase
- ticket categories
- menu item pre-orders
- QR/ticket email template
- check-in and check-in revert

### Wallet

Files:

```txt
src/modules/wallets/wallet/
```

Routes:

```txt
GET  /api/v1/wallet
GET  /api/v1/wallet/transactions
POST /api/v1/wallet/top-up
```

Wallet is currently customer-facing for:

- viewing balance
- viewing transactions
- topping up through Paystack
- paying for event tickets

### User Management, Invitations, Roles, Permissions, Audit Logs

Files:

```txt
src/modules/identity/access-management/
```

Routes:

```txt
GET    /api/v1/users
GET    /api/v1/users/:id
PATCH  /api/v1/users/:id
DELETE /api/v1/users/:id

POST /api/v1/invitations
GET  /api/v1/invitations
POST /api/v1/invitations/accept/:token
POST /api/v1/invitations/:id/resend
POST /api/v1/invitations/:id/revoke

GET   /api/v1/roles
PATCH /api/v1/roles/:role/permissions
GET   /api/v1/permissions

GET /api/v1/audit-logs
```

Current behavior:

- Super admin can manage users and inspect audit logs.
- Admin can manage operational users where permissions allow.
- Vendor can invite/manage vendor staff scoped to their vendor account.
- Role/permission creation is not the current focus; roles and permissions are seeded and can be updated by super admin where enabled.

### Finance

Files:

```txt
src/modules/finance/finance/
```

Routes:

```txt
GET  /api/v1/finance/payments
GET  /api/v1/finance/payments/export
GET  /api/v1/finance/payments/:id
POST /api/v1/finance/payments/:id/refund
GET  /api/v1/finance/reports/summary
GET  /api/v1/finance/reports/events
GET  /api/v1/finance/wallet-transactions
```

Finance users can inspect payments, refunds, exports, reports, and wallet transactions according to permissions.

### Notifications And Push

Files:

```txt
src/modules/notifications/notifications/
src/infrastructure/push/onesignal/
```

Routes:

```txt
GET  /api/v1/notification
GET  /api/v1/admin/notification
GET  /api/v1/onesignal/send-notification
POST /api/v1/onesignal/add-user-to-notification-list
POST /api/v1/onesignal/remove-user-from-notification-list
GET  /api/v1/onesignal/mark-all-notification-as-read
```

### Paystack

Files:

```txt
src/infrastructure/payments/paystack/
```

Routes:

```txt
POST /api/v1/paystack/webhook
POST /api/v1/paystack/verify-transaction
```

Paystack is used for:

- guest event ticket purchase
- logged-in user ticket purchase without wallet
- wallet top-up
- webhook processing

## Email Templates

Email service:

```txt
src/infrastructure/email/email.service.ts
```

Templates:

```txt
views/emails/auth/invite-user/html.hbs
views/emails/auth/forgot-password/html.hbs
views/emails/auth/reset-password/html.hbs
views/emails/auth/two-factor/html.hbs
views/emails/auth/signup-token/html.hbs
views/emails/event/event-ticket/html.hbs
```

Use `views/emails/<domain>/<template>/html.hbs` for new templates.

## File Uploads And Static Files

`main.ts` serves:

```txt
/upload -> ./src/public/upload
/static -> ./src/public/static
```

Storage helpers live in:

```txt
src/infrastructure/storage/
```

## Legacy Modules

Old, duplicate, or schema-incompatible modules live in:

```txt
legacy/
```

Examples:

```txt
legacy/bookings
legacy/chat
legacy/services
legacy/stripe
legacy/vendor
legacy/wallet
legacy/user-management
```

Do not import from `legacy/` directly. Restore a legacy module only when:

1. Its Prisma schema is updated.
2. Its module is registered in `src/app.module.ts`.
3. Its controllers/services compile.
4. Its permissions are defined and seeded.
5. Its tests or verification steps pass.

## Adding A New Feature

1. Put domain modules under:

```txt
src/modules/<domain>/<feature>/
```

2. Put external integrations under:

```txt
src/infrastructure/<provider-or-capability>/
```

3. Put shared helpers under:

```txt
src/common/
```

4. Add the module to:

```txt
src/app.module.ts
```

5. Add permissions in:

```txt
src/auth/rbac/permissions.enum.ts
prisma/seed.ts
```

6. Protect controller actions with:

```ts
@Permissions(Permission.SOME_PERMISSION)
```

7. Add or update Prisma models and create a migration:

```bash
npx prisma migrate dev --name feature_name
```

8. Verify:

```bash
npm run build
npm test -- --runInBand
npx prisma validate
```

## Response And Error Shape

Unhandled errors are normalized by:

```txt
src/common/filters/all-exception.filter.ts
```

Typical error response:

```json
{
  "statusCode": 403,
  "timestamp": "2026-05-27T00:00:00.000Z",
  "path": "/api/v1/example",
  "message": "Forbidden resource"
}
```

## Troubleshooting

### `User does not exist` on seeded account login

Check active and soft-delete state:

```sql
select email, "isActive", "isDeleted" from "User" where email = 'user@glee.test';
```

Seed again if needed:

```bash
npx prisma db seed
```

### Permission returns `Forbidden resource`

Check:

```txt
src/auth/rbac/permissions.enum.ts
prisma/seed.ts
```

Then confirm the role has the permission in the database.

### Prisma client is stale

Run:

```bash
npx prisma generate
```

Then restart `npm run start:dev`.

### Backend route exists but frontend gets 404

Confirm the route prefix:

```txt
/api/v1
```

Also check whether the route is in a controller registered by an active module in `src/app.module.ts`.

### Paystack payments do not initialize

Check:

```env
PAYSTACK_SECRET_KEY=
PAYSTACK_PUBLIC_KEY=
PAYSTACK_WEBHOOK_URL=
PAYSTACK_CALLBACK_URL=
```

Also confirm the amount sent to Paystack is positive and the selected ticket category belongs to the event.

### Wallet purchase fails

Check:

- user has a wallet
- wallet has sufficient balance
- event has available capacity
- selected ticket category belongs to the event
- event is not sold out

## Developer Notes

- Keep `src/app.module.ts` as the runtime module registry.
- Keep Prisma schema, service code, permissions, and seeds in sync.
- Avoid duplicating auth/role logic outside `src/auth/rbac`.
- Use structured DTO validation for new request bodies.
- Keep customer, vendor, and admin data scopes separate.
- Do not expose operational counts or competitor data to customer/vendor views.
- Use exact role and permission enum names from Prisma and `Permission`.
