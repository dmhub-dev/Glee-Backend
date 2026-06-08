import {
    EntityStatus,
    EventStatus,
    PrismaClient,
    UserRole,
} from '@prisma/client';
import * as bcrypt from 'bcrypt';

const prisma = new PrismaClient();

const CATEGORIES = [
    'Music',
    'Sports',
    'Food & Drink',
    'Arts & Theatre',
    'Nightlife',
    'Business',
    'Health & Wellness',
    'Family',
    'Other',
];

const ROLES: { name: UserRole; description: string }[] = [
    { name: UserRole.SUPER_ADMIN, description: 'Full system access' },
    { name: UserRole.ADMIN, description: 'Administrative access' },
    { name: UserRole.OPERATIONS_MANAGER, description: 'Operations management' },
    { name: UserRole.COMMERCIAL_MANAGER, description: 'Commercial management' },
    { name: UserRole.FINANCE, description: 'Finance access' },
    { name: UserRole.VENDOR, description: 'Vendor access' },
    { name: UserRole.VENDOR_STAFF, description: 'Vendor staff access' },
    { name: UserRole.CUSTOMER_SUPPORT, description: 'Customer support access' },
    { name: UserRole.CONTENT_MANAGER, description: 'Content management' },
    { name: UserRole.USER, description: 'Standard user access' },
];

const TEST_ROLE_USERS: { role: UserRole; name: string; email: string }[] = [
    {
        role: UserRole.SUPER_ADMIN,
        name: 'Test Super Admin',
        email: 'super.admin@glee.test',
    },
    { role: UserRole.ADMIN, name: 'Test Admin', email: 'admin.role@glee.test' },
    {
        role: UserRole.OPERATIONS_MANAGER,
        name: 'Test Operations Manager',
        email: 'operations.manager@glee.test',
    },
    {
        role: UserRole.COMMERCIAL_MANAGER,
        name: 'Test Commercial Manager',
        email: 'commercial.manager@glee.test',
    },
    {
        role: UserRole.FINANCE,
        name: 'Test Finance',
        email: 'finance@glee.test',
    },
    { role: UserRole.VENDOR, name: 'Test Vendor', email: 'vendor@glee.test' },
    {
        role: UserRole.VENDOR_STAFF,
        name: 'Test Vendor Staff',
        email: 'vendor.staff@glee.test',
    },
    {
        role: UserRole.CUSTOMER_SUPPORT,
        name: 'Test Customer Support',
        email: 'customer.support@glee.test',
    },
    {
        role: UserRole.CONTENT_MANAGER,
        name: 'Test Content Manager',
        email: 'content.manager@glee.test',
    },
    { role: UserRole.USER, name: 'Test User', email: 'user@glee.test' },
];

const OLD_SAMPLE_EVENT_NAME = 'Glee Sample Weekend Festival';
const SINGLE_DAY_SAMPLE_EVENT_NAME = 'Summer Music Carnival';
const MULTI_DAY_SAMPLE_EVENT_NAME = 'East Africa Cultural Festival';

const PERMISSIONS = [
    ['users:read', 'users', 'read', 'View users'],
    ['users:create', 'users', 'create', 'Create users'],
    ['users:update', 'users', 'update', 'Update users'],
    ['users:delete', 'users', 'delete', 'Delete users'],
    ['users:assign_role', 'users', 'assign_role', 'Assign user roles'],
    ['users:invite', 'users', 'invite', 'Invite users'],
    ['vendors:read', 'vendors', 'read', 'View vendors'],
    ['vendors:create', 'vendors', 'create', 'Create vendors'],
    ['vendors:update', 'vendors', 'update', 'Update vendors'],
    ['vendors:delete', 'vendors', 'delete', 'Delete vendors'],
    ['vendors:approve', 'vendors', 'approve', 'Approve vendors'],
    ['events:read', 'events', 'read', 'View events'],
    ['events:create', 'events', 'create', 'Create events'],
    ['events:update', 'events', 'update', 'Update events'],
    ['events:delete', 'events', 'delete', 'Delete events'],
    ['events:approve', 'events', 'approve', 'Approve events'],
    ['services:read', 'services', 'read', 'View services'],
    ['services:create', 'services', 'create', 'Create services'],
    ['services:update', 'services', 'update', 'Update services'],
    ['services:delete', 'services', 'delete', 'Delete services'],
    ['bookings:read', 'bookings', 'read', 'View bookings'],
    ['bookings:create', 'bookings', 'create', 'Create bookings'],
    ['bookings:update', 'bookings', 'update', 'Update bookings'],
    ['bookings:delete', 'bookings', 'delete', 'Delete bookings'],
    ['bookings:override', 'bookings', 'override', 'Override bookings'],
    ['payments:read', 'payments', 'read', 'View payments'],
    ['payments:refund', 'payments', 'refund', 'Refund payments'],
    ['payments:export', 'payments', 'export', 'Export payments'],
    ['reports:read', 'reports', 'read', 'View reports'],
    ['audit_logs:read', 'audit_logs', 'read', 'View audit logs'],
    ['categories:read', 'categories', 'read', 'View categories'],
    ['categories:create', 'categories', 'create', 'Create categories'],
    ['categories:update', 'categories', 'update', 'Update categories'],
    ['categories:delete', 'categories', 'delete', 'Delete categories'],
    ['content:manage', 'content', 'manage', 'Manage content'],
    ['notifications:read', 'notifications', 'read', 'View notifications'],
    ['chat:read', 'chat', 'read', 'View chat'],
    ['chat:create', 'chat', 'create', 'Create chat messages'],
    ['wallet:read', 'wallet', 'read', 'View wallet'],
    ['wallet:topup', 'wallet', 'topup', 'Top up wallet'],
    ['wallet:deduct', 'wallet', 'deduct', 'Deduct from wallet'],
    ['settings:manage', 'settings', 'manage', 'Manage settings'],
    ['roles:read', 'roles', 'read', 'View roles'],
    ['roles:update', 'roles', 'update', 'Update roles'],
    ['permissions:read', 'permissions', 'read', 'View permissions'],
    ['permissions:manage', 'permissions', 'manage', 'Manage permissions'],
    ['location:read', 'location', 'read', 'View locations'],
    ['location:create', 'location', 'create', 'Create locations'],
    ['location:update', 'location', 'update', 'Update locations'],
    ['location:delete', 'location', 'delete', 'Delete locations'],
    ['system:govern', 'system', 'govern', 'Govern system access'],
    ['pricing:override', 'pricing', 'override', 'Override pricing'],
    ['pricing:edit', 'pricing', 'edit', 'Edit pricing'],
] as const;

const ROLE_PERMISSIONS: Record<UserRole, string[]> = {
    [UserRole.SUPER_ADMIN]: PERMISSIONS.map(([name]) => name),
    [UserRole.ADMIN]: [
        'users:read',
        'users:create',
        'users:update',
        'users:delete',
        'users:invite',
        'vendors:read',
        'vendors:create',
        'vendors:update',
        'vendors:delete',
        'vendors:approve',
        'events:read',
        'events:create',
        'events:update',
        'events:delete',
        'events:approve',
        'services:read',
        'services:create',
        'services:update',
        'services:delete',
        'bookings:read',
        'bookings:create',
        'bookings:update',
        'bookings:delete',
        'bookings:override',
        'payments:read',
        'payments:refund',
        'payments:export',
        'reports:read',
        'categories:read',
        'categories:create',
        'categories:update',
        'categories:delete',
        'content:manage',
        'notifications:read',
        'chat:read',
        'chat:create',
        'wallet:read',
        'wallet:topup',
        'wallet:deduct',
        'location:read',
        'location:create',
        'location:update',
        'location:delete',
        'settings:manage',
        'pricing:override',
        'pricing:edit',
    ],
    [UserRole.OPERATIONS_MANAGER]: [
        'users:read',
        'vendors:read',
        'vendors:update',
        'vendors:approve',
        'events:read',
        'events:update',
        'events:approve',
        'bookings:read',
        'bookings:update',
        'bookings:override',
        'reports:read',
        'notifications:read',
        'chat:read',
        'chat:create',
        'location:read',
    ],
    [UserRole.COMMERCIAL_MANAGER]: [
        'vendors:read',
        'vendors:create',
        'vendors:update',
        'vendors:approve',
        'events:read',
        'services:read',
        'services:create',
        'services:update',
        'services:delete',
        'bookings:read',
        'pricing:edit',
        'reports:read',
    ],
    [UserRole.FINANCE]: [
        'payments:read',
        'payments:refund',
        'payments:export',
        'bookings:read',
        'reports:read',
        'wallet:read',
    ],
    [UserRole.VENDOR]: [
        'users:invite',
        'users:read',
        'users:update',
        'users:delete',
        'events:read',
        'events:create',
        'events:update',
        'categories:read',
        'location:read',
        'location:create',
        'location:update',
        'location:delete',
        'services:read',
        'services:create',
        'services:update',
        'services:delete',
        'bookings:read',
        'bookings:update',
        'payments:read',
        'wallet:read',
        'notifications:read',
        'chat:read',
        'chat:create',
    ],
    [UserRole.VENDOR_STAFF]: [
        'events:read',
        'categories:read',
        'location:read',
        'location:create',
        'location:update',
        'location:delete',
        'bookings:read',
        'bookings:update',
        'notifications:read',
        'chat:read',
        'chat:create',
    ],
    [UserRole.CUSTOMER_SUPPORT]: [
        'users:read',
        'bookings:read',
        'bookings:update',
        'chat:read',
        'chat:create',
        'notifications:read',
    ],
    [UserRole.CONTENT_MANAGER]: [
        'categories:read',
        'categories:create',
        'categories:update',
        'categories:delete',
        'content:manage',
        'events:read',
        'events:update',
        'location:read',
    ],
    [UserRole.USER]: [
        'events:read',
        'categories:read',
        'location:read',
        'bookings:read',
        'bookings:create',
        'notifications:read',
        'chat:read',
        'chat:create',
        'wallet:read',
        'wallet:topup',
    ],
};

async function main() {
    console.log('Starting database seed...');

    // Roles must be seeded before users (foreign key)
    console.log('Seeding roles...');
    for (const role of ROLES) {
        await prisma.role.upsert({
            where: { name: role.name },
            update: {},
            create: role,
        });
    }
    console.log(`Seeded ${ROLES.length} roles.`);

    console.log('Seeding permissions...');
    for (const [name, module, action, description] of PERMISSIONS) {
        await prisma.permission.upsert({
            where: { name },
            update: { module, action, description },
            create: { name, module, action, description },
        });
    }
    console.log(`Seeded ${PERMISSIONS.length} permissions.`);

    console.log('Seeding role permissions...');
    for (const roleName of Object.values(UserRole)) {
        const role = await prisma.role.findUniqueOrThrow({
            where: { name: roleName },
        });
        const permissionRows = await prisma.permission.findMany({
            where: { name: { in: ROLE_PERMISSIONS[roleName] } },
            select: { id: true },
        });

        await prisma.rolePermission.deleteMany({ where: { roleId: role.id } });
        for (const permission of permissionRows) {
            await prisma.rolePermission.create({
                data: { roleId: role.id, permissionId: permission.id },
            });
        }
    }
    console.log('Seeded role permissions.');

    // Categories
    console.log('Seeding categories...');
    for (const name of CATEGORIES) {
        await prisma.category.upsert({
            where: { name },
            update: {},
            create: { name },
        });
    }
    console.log(`Seeded ${CATEGORIES.length} categories.`);

    // Admin user
    console.log('Seeding admin user...');
    const password = await bcrypt.hash('Admin@1234', 10);
    await prisma.user.upsert({
        where: { email: 'admin@glee.com' },
        update: { twoFactorEnabled: false },
        create: {
            name: 'Super Admin',
            email: 'admin@glee.com',
            password,
            role: { connect: { name: UserRole.SUPER_ADMIN } },
            isActive: 'ACTIVE',
            twoFactorEnabled: false,
        },
    });
    console.log(
        'Admin user seeded. Email: admin@glee.com | Password: Admin@1234',
    );

    console.log('Seeding role test users...');
    const testPassword = await bcrypt.hash('Test@1234', 10);
    const testVendor = TEST_ROLE_USERS.find(
        (user) => user.role === UserRole.VENDOR,
    );
    let vendorAccountId: string | null = null;
    if (testVendor) {
        const vendor = await prisma.user.upsert({
            where: { email: testVendor.email },
            update: {
                name: testVendor.name,
                password: testPassword,
                role: { connect: { name: testVendor.role } },
                isActive: 'ACTIVE',
                isDeleted: false,
                twoFactorEnabled: false,
                vendorAccount: { disconnect: true },
            },
            create: {
                name: testVendor.name,
                email: testVendor.email,
                password: testPassword,
                role: { connect: { name: testVendor.role } },
                isActive: 'ACTIVE',
                twoFactorEnabled: false,
            },
        });
        vendorAccountId = vendor.id;
    }

    for (const testUser of TEST_ROLE_USERS.filter(
        (user) => user.role !== UserRole.VENDOR,
    )) {
        const vendorAccount =
            testUser.role === UserRole.VENDOR_STAFF && vendorAccountId
                ? { connect: { id: vendorAccountId } }
                : { disconnect: true };
        await prisma.user.upsert({
            where: { email: testUser.email },
            update: {
                name: testUser.name,
                password: testPassword,
                role: { connect: { name: testUser.role } },
                isActive: 'ACTIVE',
                isDeleted: false,
                twoFactorEnabled: false,
                vendorAccount,
            },
            create: {
                name: testUser.name,
                email: testUser.email,
                password: testPassword,
                role: { connect: { name: testUser.role } },
                isActive: 'ACTIVE',
                twoFactorEnabled: false,
                ...(testUser.role === UserRole.VENDOR_STAFF && vendorAccountId
                    ? { vendorAccount: { connect: { id: vendorAccountId } } }
                    : {}),
            },
        });
    }
    console.log(
        `Seeded ${TEST_ROLE_USERS.length} role test users. Password: Test@1234`,
    );

    console.log('Seeding sample events...');
    const activeLocations = await prisma.location.findMany({
        where: { status: EntityStatus.ACTIVE },
        orderBy: { createdAt: 'desc' },
    });
    const sampleLocation =
        activeLocations.find((location) => location.pictures.length > 0) ??
        activeLocations[0];
    const sampleCategory = await prisma.category.findFirst({
        where: { name: 'Music' },
    });
    const sampleVendor = await prisma.user.findUnique({
        where: { email: 'vendor@glee.test' },
    });

    if (!sampleLocation || !sampleCategory || !sampleVendor) {
        console.log(
            'Skipped sample events. Requires an active location, Music category, and vendor@glee.test.',
        );
    } else {
        const samplePhoto =
            sampleLocation.pictures[0] ??
            sampleLocation.floorPlanImageUrl ??
            'https://new-glee-storage.s3.us-east-1.amazonaws.com/locations/85aed236-fff1-4533-9ec4-061e8381f90b.jpg';
        async function removeSeedEvent(name: string) {
            const events = await prisma.event.findMany({
                where: { name },
                select: { id: true },
            });
            for (const event of events) {
                await prisma.ticketCategory.deleteMany({
                    where: { eventId: event.id },
                });
                await prisma.eventMenuItem.deleteMany({
                    where: { eventId: event.id },
                });
                await prisma.eventSchedule.deleteMany({
                    where: { eventId: event.id },
                });
                await prisma.eventTicket.deleteMany({
                    where: { eventId: event.id },
                });
                await prisma.event.delete({ where: { id: event.id } });
            }
        }

        async function createSeedEvent(input: {
            name: string;
            description: string;
            capacity: number;
            startDate: Date;
            endDate: Date;
            tickets: { name: string; price: number; capacity: number }[];
            menuItems: {
                name: string;
                category: string;
                price: number;
                description: string;
            }[];
            scheduleDescription: string;
        }) {
            await removeSeedEvent(input.name);
            const event = await prisma.event.create({
                data: {
                    name: input.name,
                    description: input.description,
                    capacity: input.capacity,
                    photos: [samplePhoto],
                    startDate: input.startDate,
                    endDate: input.endDate,
                    status: EventStatus.ACTIVE,
                    isDeleted: false,
                    locationId: sampleLocation.id,
                    categoryId: sampleCategory.id,
                    vendorId: sampleVendor.id,
                },
            });

            await prisma.ticketCategory.createMany({
                data: input.tickets.map((ticket) => ({
                    eventId: event.id,
                    name: ticket.name,
                    price: ticket.price,
                    capacity: ticket.capacity,
                    available: ticket.capacity,
                })),
            });

            await prisma.eventMenuItem.createMany({
                data: input.menuItems.map((item) => ({
                    eventId: event.id,
                    name: item.name,
                    category: item.category,
                    price: item.price,
                    description: item.description,
                })),
            });

            await prisma.eventSchedule.create({
                data: {
                    eventId: event.id,
                    name: input.name,
                    description: input.scheduleDescription,
                    startDate: input.startDate,
                    endDate: input.endDate,
                },
            });

            return event;
        }

        await removeSeedEvent(OLD_SAMPLE_EVENT_NAME);

        const singleDayEvent = await createSeedEvent({
            name: SINGLE_DAY_SAMPLE_EVENT_NAME,
            description:
                'A one-day seeded music event with a full-day schedule, ticket categories, and food/drink pre-orders.',
            capacity: 500,
            startDate: new Date('2026-07-05T09:00:00.000Z'),
            endDate: new Date('2026-07-05T18:00:00.000Z'),
            tickets: [
                { name: 'Regular', price: 1500, capacity: 350 },
                { name: 'VIP', price: 5000, capacity: 120 },
                { name: 'VVIP', price: 10000, capacity: 30 },
            ],
            menuItems: [
                {
                    name: 'Nyama Choma Plate',
                    category: 'food',
                    price: 1200,
                    description: 'Grilled meat plate redeemable at the gate.',
                },
                {
                    name: 'Soft Drink',
                    category: 'drink',
                    price: 250,
                    description:
                        'One chilled soft drink redeemable at the gate.',
                },
                {
                    name: 'Cocktail Voucher',
                    category: 'drink',
                    price: 900,
                    description: 'One cocktail voucher redeemable at the bar.',
                },
            ],
            scheduleDescription:
                '9:00am-10:00am guest arrival and registration, 10:00am-12:00pm opening performances and games, 12:00pm-1:00pm lunch break, 1:00pm-4:00pm main entertainment (live music, DJs, and activities), 4:00pm-5:30pm competitions and guest appearances, and 5:30pm-6:00pm closing ceremony and farewell session.',
        });

        const multiDayEvent = await createSeedEvent({
            name: MULTI_DAY_SAMPLE_EVENT_NAME,
            description:
                'A two-day seeded cultural festival with a multi-day schedule, ticket categories, and pre-order menu items.',
            capacity: 800,
            startDate: new Date('2026-08-20T09:00:00.000Z'),
            endDate: new Date('2026-08-21T18:00:00.000Z'),
            tickets: [
                { name: 'Day Pass', price: 2000, capacity: 500 },
                { name: 'Weekend Pass', price: 3500, capacity: 250 },
                { name: 'Patron Pass', price: 8000, capacity: 50 },
            ],
            menuItems: [
                {
                    name: 'Food Tasting Voucher',
                    category: 'food',
                    price: 1500,
                    description: 'Voucher for cultural food tasting sessions.',
                },
                {
                    name: 'Craft Market Token',
                    category: 'merchandise',
                    price: 1000,
                    description: 'Token redeemable at selected craft stalls.',
                },
                {
                    name: 'Fresh Juice',
                    category: 'drink',
                    price: 350,
                    description: 'Fresh juice redeemable at the festival bar.',
                },
            ],
            scheduleDescription:
                'Day 1 (9:00am-10:00am opening parade and cultural introduction, 10:00am-12:00pm traditional performances, 12:00pm-1:00pm food tasting sessions, 1:00pm-5:00pm music, dance, and storytelling showcases, 5:00pm-6:00pm closing remarks), Day 2 (9:00am-10:00am community workshop introductions, 10:00am-12:00pm craft exhibitions, 12:00pm-1:00pm lunch break, 1:00pm-4:00pm cultural competitions, 4:00pm-6:00pm award ceremony and performances).',
        });

        console.log(
            `Sample events seeded. Single-day: ${singleDayEvent.name} | Multi-day: ${multiDayEvent.name} | Location: ${sampleLocation.name}`,
        );
    }

    console.log('Seed complete.');
}

main()
    .catch((e) => {
        console.error('Seed failed:', e);
        process.exit(1);
    })
    .finally(() => prisma.$disconnect());
