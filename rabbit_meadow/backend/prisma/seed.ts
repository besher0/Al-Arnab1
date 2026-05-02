import { PrismaClient, UserRole } from '@prisma/client';

const prisma = new PrismaClient();

const DEFAULT_ADMIN_PHONE = '0500000000';

async function main() {
  const admin = await prisma.user.upsert({
    where: { phone: DEFAULT_ADMIN_PHONE },
    update: {
      name: 'مدير الأرنب',
      role: UserRole.ADMIN,
      isActive: true,
    },
    create: {
      name: 'مدير الأرنب',
      phone: DEFAULT_ADMIN_PHONE,
      role: UserRole.ADMIN,
      isActive: true,
    },
  });

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

  console.log('Seed completed: admin account and store settings are ready.');
}

main()
  .catch((error) => {
    console.error(error);
    process.exit(1);
  })
  .finally(async () => {
    await prisma.$disconnect();
  });
