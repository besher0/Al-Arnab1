import { PrismaClient, UserRole } from '@prisma/client';

const prisma = new PrismaClient();

const DEFAULT_ADMIN_PHONE = '0500000000';
const DEFAULT_DELIVERY_PASSWORD = '12345678';
const DELIVERY_ACCOUNTS = [
  { name: 'Delivery 1', phone: '0000000001' },
  { name: 'Delivery 2', phone: '0000000002' },
  { name: 'Delivery 3', phone: '0000000003' },
  { name: 'Delivery 4', phone: '0000000004' },
  { name: 'Delivery 5', phone: '0000000005' },
];

async function main() {
  const admin = await prisma.user.upsert({
    where: { phone: DEFAULT_ADMIN_PHONE },
    update: {
      name: 'Al-Arnab Admin',
      role: UserRole.ADMIN,
      isActive: true,
    },
    create: {
      name: 'Al-Arnab Admin',
      phone: DEFAULT_ADMIN_PHONE,
      role: UserRole.ADMIN,
      isActive: true,
    },
  });

  await Promise.all(
    DELIVERY_ACCOUNTS.map((account) =>
      prisma.user.upsert({
        where: { phone: account.phone },
        update: {
          name: account.name,
          role: UserRole.DELIVERY,
          isActive: true,
          passwordHash: DEFAULT_DELIVERY_PASSWORD,
        },
        create: {
          name: account.name,
          phone: account.phone,
          role: UserRole.DELIVERY,
          isActive: true,
          passwordHash: DEFAULT_DELIVERY_PASSWORD,
        },
      }),
    ),
  );

  await prisma.storeSetting.upsert({
    where: { id: 1 },
    update: {
      isOpen: true,
      currency: 'SAR',
      usdSarRate: 3.75,
      updatedById: admin.id,
    },
    create: {
      id: 1,
      isOpen: true,
      currency: 'SAR',
      usdSarRate: 3.75,
      updatedById: admin.id,
    },
  });

  console.log('Seed completed: admin + 5 delivery accounts + store settings are ready.');
}

main()
  .catch((error) => {
    console.error(error);
    process.exit(1);
  })
  .finally(async () => {
    await prisma.$disconnect();
  });
