import { PrismaClient, UserRole } from '@prisma/client';

const prisma = new PrismaClient();

// All permission definitions
const ALL_PERMISSIONS = [
  { name: 'users:read',        module: 'users',         action: 'read' },
  { name: 'users:create',      module: 'users',         action: 'create' },
  { name: 'users:update',      module: 'users',         action: 'update' },
  { name: 'users:delete',      module: 'users',         action: 'delete' },
  { name: 'users:assign_role', module: 'users',         action: 'assign_role' },
  { name: 'vendors:read',      module: 'vendors',       action: 'read' },
  { name: 'vendors:create',    module: 'vendors',       action: 'create' },
  { name: 'vendors:update',    module: 'vendors',       action: 'update' },
  { name: 'vendors:delete',    module: 'vendors',       action: 'delete' },
  { name: 'vendors:approve',   module: 'vendors',       action: 'approve' },
  { name: 'events:read',       module: 'events',        action: 'read' },
  { name: 'events:create',     module: 'events',        action: 'create' },
  { name: 'events:update',     module: 'events',        action: 'update' },
  { name: 'events:delete',     module: 'events',        action: 'delete' },
  { name: 'events:approve',    module: 'events',        action: 'approve' },
  { name: 'services:read',     module: 'services',      action: 'read' },
  { name: 'services:create',   module: 'services',      action: 'create' },
  { name: 'services:update',   module: 'services',      action: 'update' },
  { name: 'services:delete',   module: 'services',      action: 'delete' },
  { name: 'bookings:read',     module: 'bookings',      action: 'read' },
  { name: 'bookings:create',   module: 'bookings',      action: 'create' },
  { name: 'bookings:update',   module: 'bookings',      action: 'update' },
  { name: 'bookings:delete',   module: 'bookings',      action: 'delete' },
  { name: 'bookings:override', module: 'bookings',      action: 'override' },
  { name: 'payments:read',     module: 'payments',      action: 'read' },
  { name: 'payments:refund',   module: 'payments',      action: 'refund' },
  { name: 'payments:export',   module: 'payments',      action: 'export' },
  { name: 'reports:read',      module: 'reports',       action: 'read' },
  { name: 'categories:read',   module: 'categories',    action: 'read' },
  { name: 'categories:create', module: 'categories',    action: 'create' },
  { name: 'categories:update', module: 'categories',    action: 'update' },
  { name: 'categories:delete', module: 'categories',    action: 'delete' },
  { name: 'content:manage',    module: 'content',       action: 'manage' },
  { name: 'notifications:read',module: 'notifications', action: 'read' },
  { name: 'chat:read',         module: 'chat',          action: 'read' },
  { name: 'chat:create',       module: 'chat',          action: 'create' },
  { name: 'system:govern',     module: 'system',        action: 'govern' },
  { name: 'pricing:override',  module: 'pricing',       action: 'override' },
  { name: 'pricing:edit',      module: 'pricing',       action: 'edit' },
  { name: 'wallet:read',       module: 'wallet',        action: 'read' },
  { name: 'wallet:topup',      module: 'wallet',        action: 'topup' },
  { name: 'wallet:deduct',     module: 'wallet',        action: 'deduct' },
  { name: 'settings:manage',   module: 'settings',      action: 'manage' },
  { name: 'location:read',     module: 'location',      action: 'read' },
  { name: 'location:create',   module: 'location',      action: 'create' },
  { name: 'location:update',   module: 'location',      action: 'update' },
  { name: 'location:delete',   module: 'location',      action: 'delete' },
];

// Permissions each role receives (by permission name)
const ROLE_PERMISSIONS: Record<UserRole, string[]> = {
  SUPER_ADMIN: ALL_PERMISSIONS.map(p => p.name), // all
  ADMIN: [
    'users:read','users:create','users:update',
    'vendors:read','vendors:create','vendors:update','vendors:approve',
    'events:read','events:create','events:update','events:delete','events:approve',
    'services:read','services:create','services:update','services:delete',
    'bookings:read','bookings:create','bookings:update','bookings:delete','bookings:override',
    'payments:read',
    'reports:read',
    'categories:read','categories:create','categories:update','categories:delete',
    'content:manage',
    'notifications:read',
    'pricing:override','pricing:edit',
    'settings:manage',
    'wallet:read','wallet:topup','wallet:deduct',
    'location:read','location:create','location:update','location:delete',
  ],
  OPERATIONS_MANAGER: [
    'bookings:read','bookings:create','bookings:update','bookings:override',
    'events:read','events:update',
    'services:read',
    'users:read',
    'reports:read',
    'notifications:read',
    'pricing:override',
  ],
  COMMERCIAL_MANAGER: [
    'vendors:read','vendors:create','vendors:update','vendors:approve',
    'events:read','events:create','events:update',
    'bookings:create',
    'reports:read',
    'categories:read',
    'pricing:override','pricing:edit',
  ],
  FINANCE: [
    'payments:read','payments:refund','payments:export',
    'reports:read',
  ],
  VENDOR: [
    'events:read','events:create','events:update','events:delete',
    'services:read','services:create','services:update','services:delete',
    'bookings:read','bookings:create','bookings:update','bookings:delete',
    'reports:read',
    'vendors:update',
    'notifications:read',
    'categories:read',
    'pricing:edit',
    'chat:read','chat:create',
    'payments:read',
  ],
  VENDOR_STAFF: [
    'bookings:read','bookings:update',
    'events:read',
    'services:read','services:update',
    'notifications:read',
    'categories:read',
    'chat:read',
  ],
  CUSTOMER_SUPPORT: [
    'users:read',
    'bookings:read',
    'notifications:read',
    'chat:read',
  ],
  CONTENT_MANAGER: [
    'content:manage',
    'categories:read',
    'events:read','events:create','events:update',
    'notifications:read',
  ],
  USER: [
    'events:read',
    'services:read',
    'bookings:read','bookings:create',
    'notifications:read',
    'chat:read','chat:create',
    'categories:read',
    'payments:read',
    'wallet:read','wallet:topup',
  ],
};

async function main() {
  console.log('Seeding permissions...');
  for (const perm of ALL_PERMISSIONS) {
    await prisma.permission.upsert({
      where: { name: perm.name },
      update: {},
      create: perm,
    });
  }

  console.log('Seeding roles and assigning permissions...');
  for (const roleName of Object.values(UserRole)) {
    const role = await prisma.role.upsert({
      where: { name: roleName },
      update: {},
      create: { name: roleName },
    });

    const permNames = ROLE_PERMISSIONS[roleName] ?? [];
    const perms = await prisma.permission.findMany({
      where: { name: { in: permNames } },
    });

    for (const perm of perms) {
      await prisma.rolePermission.upsert({
        where: { roleId_permissionId: { roleId: role.id, permissionId: perm.id } },
        update: {},
        create: { roleId: role.id, permissionId: perm.id },
      });
    }

    console.log(`  ${roleName}: ${perms.length} permissions`);
  }

  console.log('RBAC seed complete.');
}

main()
  .catch(console.error)
  .finally(() => prisma.$disconnect());
