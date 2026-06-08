-- Insert chat permissions if they don't already exist.
-- Uses ON CONFLICT DO NOTHING so this is safe to run on any DB state.
INSERT INTO "permissions" ("id", "name", "module", "action", "description", "createdAt", "updatedAt")
VALUES
  (gen_random_uuid()::text, 'chat:read',   'chat', 'read',   'View chat',             NOW(), NOW()),
  (gen_random_uuid()::text, 'chat:create', 'chat', 'create', 'Create chat messages',  NOW(), NOW())
ON CONFLICT ("name") DO NOTHING;

-- Assign chat:read to all roles that require chat access.
INSERT INTO "role_permissions" ("roleId", "permissionId")
SELECT r."id", p."id"
FROM "roles" r
CROSS JOIN "permissions" p
WHERE r."name" IN (
  'SUPER_ADMIN',
  'ADMIN',
  'OPERATIONS_MANAGER',
  'VENDOR',
  'VENDOR_STAFF',
  'CUSTOMER_SUPPORT',
  'USER'
)
  AND p."name" = 'chat:read'
ON CONFLICT ("roleId", "permissionId") DO NOTHING;

-- Assign chat:create to all roles that can send messages.
INSERT INTO "role_permissions" ("roleId", "permissionId")
SELECT r."id", p."id"
FROM "roles" r
CROSS JOIN "permissions" p
WHERE r."name" IN (
  'SUPER_ADMIN',
  'ADMIN',
  'OPERATIONS_MANAGER',
  'VENDOR',
  'VENDOR_STAFF',
  'CUSTOMER_SUPPORT',
  'USER'
)
  AND p."name" = 'chat:create'
ON CONFLICT ("roleId", "permissionId") DO NOTHING;
