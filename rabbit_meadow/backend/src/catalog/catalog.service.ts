import { Injectable } from '@nestjs/common';
import { PrismaService } from '../prisma/prisma.service';
import { decimalToNumber, roundTo2 } from '../common/utils/decimal.util';
import { ListProductsQueryDto } from './dto/list-products-query.dto';

type CacheEntry<T> = {
  expiresAt: number;
  value: T;
};

@Injectable()
export class CatalogService {
  private readonly cacheTtlMs = 30_000;
  private readonly cache = new Map<string, CacheEntry<unknown>>();
  private readonly pending = new Map<string, Promise<unknown>>();

  constructor(private readonly prisma: PrismaService) {}

  async listCategories() {
    return this.cached('categories', async () => {
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
    });
  }

  async listProducts(query: ListProductsQueryDto) {
    const activeOnly = query.activeOnly !== 'false';
    const settings = await this.getStoreSettings();
    const exchangeRate = this.getExchangeRate(settings?.usdSarRate);
    const key = query.categoryId
      ? `products:${query.categoryId}:${activeOnly ? 'active' : 'all'}:${exchangeRate}`
      : `products:${activeOnly ? 'active' : 'all'}:${exchangeRate}`;

    return this.cached(key, async () => {
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
        price: this.toDisplayPrice(product.sellPrice, exchangeRate),
        costPrice: decimalToNumber(product.costPrice),
        imageUrl: product.imageUrl,
        isActive: product.isActive,
        isNew: product.isNew,
      }));
    });
  }

  async bootstrapData() {
    const settings = await this.getStoreSettings();
    const exchangeRate = this.getExchangeRate(settings?.usdSarRate);
    const currency = settings?.currency ?? 'SYP';
    const isOpen = settings?.isOpen ?? true;

    return this.cached(`bootstrap:${currency}:${exchangeRate}:${isOpen}`, async () => {
      const [settings, categories, products] = await Promise.all([
        this.getStoreSettings(),
        this.listCategories(),
        this.listProducts({ activeOnly: 'true' }),
      ]);

      return {
        store: {
          isOpen: settings?.isOpen ?? true,
          currency: settings?.currency ?? 'SYP',
          usdSarRate: this.getExchangeRate(settings?.usdSarRate),
        },
        categories,
        products,
      };
    });
  }

  private async getStoreSettings() {
    return this.prisma.storeSetting.findUnique({ where: { id: 1 } });
  }

  private getExchangeRate(value: unknown) {
    const rate = decimalToNumber(value);
    return rate > 0 ? rate : 15000;
  }

  private toDisplayPrice(price: unknown, exchangeRate: number) {
    return roundTo2(decimalToNumber(price) * exchangeRate);
  }

  private async cached<T>(key: string, loader: () => Promise<T>): Promise<T> {
    const now = Date.now();
    const existing = this.cache.get(key);
    if (existing && existing.expiresAt > now) {
      return existing.value as T;
    }

    const inFlight = this.pending.get(key);
    if (inFlight) {
      return inFlight as Promise<T>;
    }

    const task = loader()
      .then((result) => {
        this.cache.set(key, {
          value: result,
          expiresAt: Date.now() + this.cacheTtlMs,
        });
        this.pending.delete(key);
        return result;
      })
      .catch((error) => {
        this.pending.delete(key);
        throw error;
      });

    this.pending.set(key, task);
    return task;
  }
}
