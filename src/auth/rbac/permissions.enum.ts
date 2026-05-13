export const Permission = {
  // Users
  USERS_READ:        'users:read',
  USERS_CREATE:      'users:create',
  USERS_UPDATE:      'users:update',
  USERS_DELETE:      'users:delete',
  USERS_ASSIGN_ROLE: 'users:assign_role',

  // Vendors
  VENDORS_READ:    'vendors:read',
  VENDORS_CREATE:  'vendors:create',
  VENDORS_UPDATE:  'vendors:update',
  VENDORS_DELETE:  'vendors:delete',
  VENDORS_APPROVE: 'vendors:approve',

  // Events
  EVENTS_READ:    'events:read',
  EVENTS_CREATE:  'events:create',
  EVENTS_UPDATE:  'events:update',
  EVENTS_DELETE:  'events:delete',
  EVENTS_APPROVE: 'events:approve',

  // Services
  SERVICES_READ:   'services:read',
  SERVICES_CREATE: 'services:create',
  SERVICES_UPDATE: 'services:update',
  SERVICES_DELETE: 'services:delete',

  // Bookings
  BOOKINGS_READ:     'bookings:read',
  BOOKINGS_CREATE:   'bookings:create',
  BOOKINGS_UPDATE:   'bookings:update',
  BOOKINGS_DELETE:   'bookings:delete',
  BOOKINGS_OVERRIDE: 'bookings:override',

  // Payments
  PAYMENTS_READ:   'payments:read',
  PAYMENTS_REFUND: 'payments:refund',
  PAYMENTS_EXPORT: 'payments:export',

  // Reports
  REPORTS_READ: 'reports:read',

  // Categories
  CATEGORIES_READ:   'categories:read',
  CATEGORIES_CREATE: 'categories:create',
  CATEGORIES_UPDATE: 'categories:update',
  CATEGORIES_DELETE: 'categories:delete',

  // Content
  CONTENT_MANAGE: 'content:manage',

  // Notifications
  NOTIFICATIONS_READ: 'notifications:read',

  // Chat
  CHAT_READ:   'chat:read',
  CHAT_CREATE: 'chat:create',

  // System
  SYSTEM_GOVERN:    'system:govern',
  PRICING_OVERRIDE: 'pricing:override',
  PRICING_EDIT:     'pricing:edit',
} as const;

export type PermissionKey = typeof Permission[keyof typeof Permission];
