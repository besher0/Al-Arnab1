import { Injectable } from '@nestjs/common';
import { PrismaService } from '../prisma/prisma.service';
import { decimalToNumber } from '../common/utils/decimal.util';
import { ListProductsQueryDto } from './dto/list-products-query.dto';

@Injectable()
export class CatalogService {
  constructor(private readonly prisma: PrismaService) {}

  async listCategories() {
    const categories = await this.prisma.category.findMany({
      where: { isActive: true },
      orderBy: [{ sortOrder: 'asc' }, { createdAt: 'asc' }],
    });

    return categories.map((category) => ({
      id: category.id,
      slug: category.slug,
      nameAr: category.nameAr,
      nameEn: category.nameEn,
      imageUrl: category.imageUrl,
      description: category.description,
    }));
  }

  async listProducts(query: ListProductsQueryDto) {
    const activeOnly = query.activeOnly !== 'false';

    const products = await this.prisma.product.findMany({
      where: {
        ...(query.categoryId ? { categoryId: query.categoryId } : {}),
        ...(activeOnly ? { isActive: true } : {}),
      },
      include: {
        category: true,
      },
      orderBy: [{ category: { sortOrder: 'asc' } }, { nameAr: 'asc' }],
    });

    return products.map((product) => ({
      id: product.id,
      categoryId: product.categoryId,
      categoryName: product.category.nameAr,
      name: product.nameAr,
      nameEn: product.nameEn,
      description: product.description,
      unit: product.unit,
      price: decimalToNumber(product.sellPrice),
      costPrice: decimalToNumber(product.costPrice),
      stockQty: decimalToNumber(product.stockQty),
      minStock: decimalToNumber(product.minStock),
      imageUrl: product.imageUrl,
      isActive: product.isActive,
      isNew: product.isNew,
    }));
  }

  async bootstrapData() {
    const [settings, categories, products] = await Promise.all([
      this.prisma.storeSetting.findUnique({ where: { id: 1 } }),
      this.listCategories(),
      this.listProducts({ activeOnly: 'true' }),
    ]);

    return {
      store: {
        isOpen: settings?.isOpen ?? true,
        currency: settings?.currency ?? 'SYP',
        usdSarRate: decimalToNumber(settings?.usdSarRate) || 15000,
      },
      categories,
      products,
    };
  }
}
