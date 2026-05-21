import { PrismaClient, UserRole } from '@prisma/client';
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
    update: {},
    create: {
      name: 'Super Admin',
      email: 'admin@glee.com',
      password,
      role: { connect: { name: UserRole.SUPER_ADMIN } },
      isActive: 'ACTIVE',
    },
  });
  console.log('Admin user seeded. Email: admin@glee.com | Password: Admin@1234');

  console.log('Seed complete.');
}

main()
  .catch((e) => {
    console.error('Seed failed:', e);
    process.exit(1);
  })
  .finally(() => prisma.$disconnect());
