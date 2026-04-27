import { PrismaClient, Unit, UserRole } from '@prisma/client';

const prisma = new PrismaClient();

const categories = [
  { slug: 'vegetables', nameAr: 'الخضروات', nameEn: 'Vegetables', sortOrder: 1 },
  { slug: 'dairy', nameAr: 'الألبان والأجبان', nameEn: 'Dairy', sortOrder: 2 },
  { slug: 'offers', nameAr: 'العروض', nameEn: 'Offers', sortOrder: 3 },
];

const products = [
  {
    id: 'carrot',
    categorySlug: 'vegetables',
    nameAr: 'جزر عضوي',
    nameEn: 'Organic Carrots',
    sellPrice: 12.5,
    costPrice: 7,
    stockQty: 120,
    minStock: 10,
    unit: Unit.KG,
    imageUrl:
      'https://images.unsplash.com/photo-1447175008436-054170c2e979?auto=format&fit=crop&w=800&q=80',
  },
  {
    id: 'lettuce',
    categorySlug: 'vegetables',
    nameAr: 'خس روماني',
    nameEn: 'Romaine Lettuce',
    sellPrice: 4,
    costPrice: 2,
    stockQty: 180,
    minStock: 20,
    unit: Unit.BUNDLE,
    imageUrl:
      'https://images.unsplash.com/photo-1622205313162-be1d5712a43f?auto=format&fit=crop&w=800&q=80',
  },
  {
    id: 'tomato',
    categorySlug: 'vegetables',
    nameAr: 'طماطم كرزية حمراء',
    nameEn: 'Cherry Tomatoes',
    sellPrice: 14.5,
    costPrice: 9,
    stockQty: 95,
    minStock: 15,
    unit: Unit.KG,
    imageUrl:
      'https://images.unsplash.com/photo-1592924357228-91a4daadcfea?auto=format&fit=crop&w=800&q=80',
  },
  {
    id: 'milk',
    categorySlug: 'dairy',
    nameAr: 'حليب كامل الدسم عضوي',
    nameEn: 'Organic Whole Milk',
    sellPrice: 12.5,
    costPrice: 8,
    stockQty: 75,
    minStock: 10,
    unit: Unit.PIECE,
    imageUrl:
      'https://images.unsplash.com/photo-1563636619-e9143da7973b?auto=format&fit=crop&w=800&q=80',
  },
  {
    id: 'feta',
    categorySlug: 'dairy',
    nameAr: 'جبنة فيتا يونانية',
    nameEn: 'Greek Feta',
    sellPrice: 24,
    costPrice: 16,
    stockQty: 60,
    minStock: 10,
    unit: Unit.PIECE,
    imageUrl:
      'https://images.unsplash.com/photo-1625938144755-652e08e359b7?auto=format&fit=crop&w=800&q=80',
  },
  {
    id: 'yogurt',
    categorySlug: 'dairy',
    nameAr: 'زبادي يوناني',
    nameEn: 'Greek Yogurt',
    sellPrice: 5.75,
    costPrice: 3.5,
    stockQty: 160,
    minStock: 25,
    unit: Unit.PIECE,
    imageUrl:
      'https://images.unsplash.com/photo-1488477304112-4944851de03d?auto=format&fit=crop&w=800&q=80',
  },
  {
    id: 'butter',
    categorySlug: 'dairy',
    nameAr: 'زبدة طبيعية',
    nameEn: 'Natural Butter',
    sellPrice: 18.5,
    costPrice: 11,
    stockQty: 84,
    minStock: 10,
    unit: Unit.PIECE,
    imageUrl:
      'https://images.unsplash.com/photo-1589985270958-b2f7f90d8fd8?auto=format&fit=crop&w=800&q=80',
  },
  {
    id: 'labneh',
    categorySlug: 'dairy',
    nameAr: 'لبنة بلدية',
    nameEn: 'Traditional Labneh',
    sellPrice: 15,
    costPrice: 9,
    stockQty: 110,
    minStock: 15,
    unit: Unit.PIECE,
    imageUrl:
      'https://images.unsplash.com/photo-1601050690597-df0568f70950?auto=format&fit=crop&w=800&q=80',
  },
  {
    id: 'grapes',
    categorySlug: 'offers',
    nameAr: 'عنب أخضر طازج',
    nameEn: 'Fresh Green Grapes',
    sellPrice: 12.5,
    costPrice: 8,
    stockQty: 90,
    minStock: 12,
    unit: Unit.KG,
    imageUrl:
      'https://images.unsplash.com/photo-1537640538966-79f369143f8f?auto=format&fit=crop&w=800&q=80',
  },
  {
    id: 'bread',
    categorySlug: 'offers',
    nameAr: 'خبز ريفي',
    nameEn: 'Country Bread',
    sellPrice: 5.5,
    costPrice: 2.5,
    stockQty: 220,
    minStock: 30,
    unit: Unit.PIECE,
    imageUrl:
      'https://images.unsplash.com/photo-1509440159596-0249088772ff?auto=format&fit=crop&w=800&q=80',
  },
];

async function main() {
  const admin = await prisma.user.upsert({
    where: { phone: '0500000000' },
    update: {
      name: 'مدير الأرنب',
      role: UserRole.ADMIN,
      isActive: true,
    },
    create: {
      name: 'مدير الأرنب',
      phone: '0500000000',
      role: UserRole.ADMIN,
      isActive: true,
    },
  });

  for (const item of categories) {
    await prisma.category.upsert({
      where: { slug: item.slug },
      update: {
        nameAr: item.nameAr,
        nameEn: item.nameEn,
        sortOrder: item.sortOrder,
        isActive: true,
      },
      create: {
        slug: item.slug,
        nameAr: item.nameAr,
        nameEn: item.nameEn,
        sortOrder: item.sortOrder,
        isActive: true,
      },
    });
  }

  const categoryMap = new Map<string, string>();
  const dbCategories = await prisma.category.findMany();
  dbCategories.forEach((category) => categoryMap.set(category.slug, category.id));

  for (const item of products) {
    const categoryId = categoryMap.get(item.categorySlug);
    if (!categoryId) {
      continue;
    }

    await prisma.product.upsert({
      where: { id: item.id },
      update: {
        categoryId,
        nameAr: item.nameAr,
        nameEn: item.nameEn,
        sellPrice: item.sellPrice,
        costPrice: item.costPrice,
        stockQty: item.stockQty,
        minStock: item.minStock,
        unit: item.unit,
        imageUrl: item.imageUrl,
        isActive: true,
      },
      create: {
        id: item.id,
        categoryId,
        nameAr: item.nameAr,
        nameEn: item.nameEn,
        sellPrice: item.sellPrice,
        costPrice: item.costPrice,
        stockQty: item.stockQty,
        minStock: item.minStock,
        unit: item.unit,
        imageUrl: item.imageUrl,
        isActive: true,
      },
    });
  }

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

  const customer = await prisma.user.upsert({
    where: { phone: '0511111111' },
    update: {
      name: 'عميل تجريبي',
      role: UserRole.CUSTOMER,
      isActive: true,
    },
    create: {
      name: 'عميل تجريبي',
      phone: '0511111111',
      role: UserRole.CUSTOMER,
      isActive: true,
    },
  });

  await prisma.cart.upsert({
    where: {
      userId_status: {
        userId: customer.id,
        status: 'ACTIVE',
      },
    },
    update: {},
    create: {
      userId: customer.id,
      status: 'ACTIVE',
    },
  });

  console.log('Seed completed');
}

main()
  .catch((error) => {
    console.error(error);
    process.exit(1);
  })
  .finally(async () => {
    await prisma.$disconnect();
  });
