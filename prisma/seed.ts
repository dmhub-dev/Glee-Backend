import { PrismaClient } from '@prisma/client';
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

async function main() {
  console.log('🌱 Starting database seed...');

  // Seed categories
  console.log('📚 Seeding categories...');
  for (const name of CATEGORIES) {
    await prisma.category.upsert({
      where: { name },
      update: {},
      create: { name },
    });
  }
  console.log(`✅ Seeded ${CATEGORIES.length} categories.`);

  // Seed admin user
  console.log('👤 Seeding admin user...');
  const password = await bcrypt.hash('Admin@1234', 10);
  await prisma.user.upsert({
    where: { email: 'admin@glee.com' },
    update: {},
    create: {
      name: 'Super Admin',
      email: 'admin@glee.com',
      password,
      role: { connect: { name: 'ADMIN' } },
      isActive: 'ACTIVE',
      profileStatus: true,
      notificationStatus: true,
    },
  });
  console.log('✅ Admin user seeded.');

  console.log('🎉 Database seeding completed successfully!');
}

main()
  .catch((e) => {
    console.error('❌ Error during seed:', e);
    process.exit(1);
  })
  .finally(() => {
    console.log('Disconnecting from database...');
    prisma.$disconnect();
  });
