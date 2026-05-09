import {
  BadRequestException,
  Injectable,
  NotFoundException,
  ServiceUnavailableException,
} from '@nestjs/common';
import { OrderStatus, Prisma } from '@prisma/client';
import { decimalToNumber, roundTo2 } from '../common/utils/decimal.util';
import {
  buildDiscountIndex,
  DiscountIndex,
  resolveBestDiscount,
} from '../common/utils/discount.util';
import { NotificationsService } from '../notifications/notifications.service';
import { PrismaService } from '../prisma/prisma.service';
import { AddCartItemDto } from './dto/add-cart-item.dto';
import { CheckoutCartDto } from './dto/checkout-cart.dto';
import { UpdateCartItemDto } from './dto/update-cart-item.dto';

@Injectable()
export class CartService {
  constructor(
    private readonly prisma: PrismaService,
    private readonly notificationsService: NotificationsService,
  ) {}

  async getCart(userId: string) {
    const cart = await this.ensureActiveCart(userId);
    const [exchangeRate, discountIndex] = await Promise.all([
      this.getExchangeRate(),
      this.getActiveDiscountIndex(),
    ]);

    const fullCart = await this.prisma.cart.findUnique({
      where: { id: cart.id },
      include: {
        items: {
          include: {
            product: true,
          },
          orderBy: {
            createdAt: 'asc',
          },
        },
      },
    });

    const items = (fullCart?.items ?? []).map((item) => {
      const pricing = this.resolveCartItemPricing({
        productId: item.productId,
        categoryId: item.product.categoryId,
        qty: item.qty,
        unitPriceSnapshot: item.unitPriceSnapshot,
      }, exchangeRate, discountIndex);

      return {
        id: item.productId,
        name: item.product.nameAr,
        nameEn: item.product.nameEn,
        imageUrl: item.product.imageUrl,
        unit: item.product.unit,
        price: pricing.unitPrice,
        originalPrice: pricing.baseUnitPrice,
        qty: pricing.qty,
        total: pricing.lineTotal,
        hasDiscount: Boolean(pricing.discount),
        discountAmount: pricing.lineDiscount,
        discount: pricing.discount
          ? {
              id: pricing.discount.id,
              title: pricing.discount.title,
              type: pricing.discount.type,
              value: pricing.discount.value,
              targetType: pricing.discount.targetType,
            }
          : null,
      };
    });

    const itemCount = items.reduce((sum, item) => sum + item.qty, 0);
    const subtotal = roundTo2(items.reduce((sum, item) => sum + item.total, 0));
    const discountTotal = roundTo2(
      items.reduce((sum, item) => sum + (Number(item.discountAmount) || 0), 0),
    );

    return {
      items,
      itemCount: roundTo2(itemCount),
      subtotal,
      discountTotal,
      cartId: cart.id,
    };
  }

  async addItem(userId: string, payload: AddCartItemDto) {
    const qty = roundTo2(payload.qty);
    if (qty <= 0) {
      throw new BadRequestException('الكمية غير صالحة.');
    }

    const product = await this.prisma.product.findUnique({
      where: { id: payload.productId },
    });

    if (!product || !product.isActive) {
      throw new NotFoundException('المنتج غير متوفر.');
    }

    const cart = await this.ensureActiveCart(userId);
    const existing = await this.prisma.cartItem.findUnique({
      where: {
        cartId_productId: {
          cartId: cart.id,
          productId: payload.productId,
        },
      },
    });

    if (existing) {
      const nextQty = roundTo2(decimalToNumber(existing.qty) + qty);
      await this.prisma.cartItem.update({
        where: { id: existing.id },
        data: {
          qty: nextQty,
          unitPriceSnapshot: product.sellPrice,
        },
      });
    } else {
      await this.prisma.cartItem.create({
        data: {
          cartId: cart.id,
          productId: payload.productId,
          qty,
          unitPriceSnapshot: product.sellPrice,
        },
      });
    }

    return this.getCart(userId);
  }

  async setItemQty(userId: string, productId: string, payload: UpdateCartItemDto) {
    const qty = roundTo2(payload.qty);
    const cart = await this.ensureActiveCart(userId);

    const existing = await this.prisma.cartItem.findUnique({
      where: {
        cartId_productId: {
          cartId: cart.id,
          productId,
        },
      },
    });

    if (!existing && qty > 0) {
      return this.addItem(userId, { productId, qty });
    }

    if (!existing) {
      return this.getCart(userId);
    }

    if (qty <= 0) {
      await this.prisma.cartItem.delete({ where: { id: existing.id } });
      return this.getCart(userId);
    }

    const product = await this.prisma.product.findUnique({ where: { id: productId } });
    await this.prisma.cartItem.update({
      where: { id: existing.id },
      data: {
        qty,
        ...(product ? { unitPriceSnapshot: product.sellPrice } : {}),
      },
    });

    return this.getCart(userId);
  }

  async clearCart(userId: string) {
    const cart = await this.ensureActiveCart(userId);
    await this.prisma.cartItem.deleteMany({ where: { cartId: cart.id } });
    return this.getCart(userId);
  }

  async listUserOrders(userId: string) {
    const orders = await this.prisma.order.findMany({
      where: { userId },
      orderBy: { createdAt: 'desc' },
      include: {
        address: true,
        items: {
          include: {
            product: true,
          },
          orderBy: {
            createdAt: 'asc',
          },
        },
      },
    });

    return orders.map((order) => this.mapUserOrder(order));
  }

  async confirmOrder(userId: string, orderId: string) {
    const order = await this.prisma.order.findUnique({
      where: { id: orderId },
      include: {
        address: true,
        items: { include: { product: true }, orderBy: { createdAt: 'asc' } },
      },
    });
    if (!order || order.userId !== userId) {
      throw new NotFoundException('الطلب غير موجود.');
    }

    if (order.status === OrderStatus.DELIVERED) {
      return this.mapUserOrder(order);
    }

    if (order.status !== OrderStatus.ON_THE_WAY && order.status !== OrderStatus.PREPARING) {
      throw new BadRequestException('لا يمكن تأكيد هذا الطلب في حالته الحالية.');
    }

    const updated = await this.prisma.$transaction(async (tx) => {
      await tx.order.update({ where: { id: orderId }, data: { status: OrderStatus.DELIVERED } });

      await tx.orderStatusLog.create({
        data: {
          orderId,
          status: OrderStatus.DELIVERED,
          changedById: userId,
          note: 'تم تأكيد الاستلام من العميل.',
        },
      });

      return tx.order.findUnique({
        where: { id: orderId },
        include: {
          address: true,
          items: { include: { product: true }, orderBy: { createdAt: 'asc' } },
        },
      });
    });

    if (!updated) throw new BadRequestException('تعذر تحديث حالة الطلب.');

    await this.notificationsService.notifyOrderDeliveredForAdmins({
      orderId: order.id,
      orderNumber: order.orderNumber,
      userId: order.userId,
    });

    return this.mapUserOrder(updated);
  }

  async returnOrder(userId: string, orderId: string) {
    const order = await this.prisma.order.findUnique({ where: { id: orderId }, include: { items: { include: { product: true } } } });
    if (!order || order.userId !== userId) {
      throw new NotFoundException('الطلب غير موجود.');
    }

    if (order.status !== OrderStatus.DELIVERED) {
      throw new BadRequestException('يمكن طلب إرجاع فقط للطلبات المسلَّمة.');
    }

    const updated = await this.prisma.$transaction(async (tx) => {
      await tx.order.update({ where: { id: orderId }, data: { status: OrderStatus.CANCELLED } });

      await tx.orderStatusLog.create({
        data: {
          orderId,
          status: OrderStatus.CANCELLED,
          changedById: userId,
          note: 'تم إرجاع الطلب من العميل.',
        },
      });

      return tx.order.findUnique({
        where: { id: orderId },
        include: {
          address: true,
          items: { include: { product: true }, orderBy: { createdAt: 'asc' } },
        },
      });
    });

    if (!updated) throw new BadRequestException('تعذر معالجة الإرجاع.');

    await this.notificationsService.notifyOrderCancelledForAdmins({
      orderId: order.id,
      orderNumber: order.orderNumber,
      userId: order.userId,
    });

    return this.mapUserOrder(updated);
  }

  async checkout(userId: string, payload: CheckoutCartDto) {
    return this.withDbRetry(async () => {
      const [exchangeRate, discountIndex] = await Promise.all([
        this.getExchangeRate(),
        this.getActiveDiscountIndex(),
      ]);
      const user = await this.prisma.user.findUnique({
        where: { id: userId },
        select: { phone: true, isActive: true },
      });
      if (!user || !user.isActive) {
        throw new NotFoundException('المستخدم غير موجود.');
      }

      const normalizedUserPhone = typeof user.phone === 'string' ? user.phone.trim() : '';
      const hasRealAccountPhone =
        Boolean(normalizedUserPhone) && !normalizedUserPhone.startsWith('guest-');
      const normalizedAlternatePhone = this.normalizeOptionalPhone(payload.alternatePhone);
      if (!hasRealAccountPhone && !normalizedAlternatePhone) {
        throw new BadRequestException('رقم التواصل البديل مطلوب لحسابات الضيوف.');
      }
      const contactPhone =
        normalizedAlternatePhone || (hasRealAccountPhone ? normalizedUserPhone : null);

      const latitude = this.normalizeCoordinate(payload.latitude, -90, 90, 'خط العرض');
      const longitude = this.normalizeCoordinate(payload.longitude, -180, 180, 'خط الطول');
      const itemNotes = this.normalizeItemNotes(payload.itemNotes);

      const cart = await this.ensureActiveCart(userId);
      const cartWithItems = await this.prisma.cart.findUnique({
        where: { id: cart.id },
        include: {
          items: {
            include: {
              product: true,
            },
            orderBy: {
              createdAt: 'asc',
            },
          },
        },
      });

      const cartItems = cartWithItems?.items ?? [];
      if (!cartItems.length) {
        throw new BadRequestException('السلة فارغة. أضف منتجات أولاً.');
      }

      const pricedCartItems = cartItems.map((item) =>
        this.resolveCartItemPricing(
          {
            productId: item.productId,
            categoryId: item.product?.categoryId || '',
            qty: item.qty,
            unitPriceSnapshot: item.unitPriceSnapshot,
          },
          exchangeRate,
          discountIndex,
        ),
      );

      const subtotal = roundTo2(
        pricedCartItems.reduce((sum, item) => sum + item.baseLineTotal, 0),
      );
      const discountTotal = roundTo2(
        pricedCartItems.reduce((sum, item) => sum + item.lineDiscount, 0),
      );
      const deliveryFee = 0;
      const total = roundTo2(subtotal - discountTotal + deliveryFee);

      const createdOrder = await this.prisma.$transaction(async (tx) => {
        for (const item of cartItems) {
          if (!item.product || !item.product.isActive) {
            throw new NotFoundException('أحد المنتجات في السلة غير متوفر.');
          }

          const qty = roundTo2(decimalToNumber(item.qty));

          if (qty <= 0) {
            throw new BadRequestException('يوجد عنصر بكمية غير صالحة في السلة.');
          }

        }

        await tx.userAddress.updateMany({
          where: { userId, isDefault: true },
          data: { isDefault: false },
        });

        const address = await tx.userAddress.create({
          data: {
            userId,
            label: 'موقع الطلب',
            city: 'توصيل عبر GPS',
            street: `GPS: ${latitude.toFixed(7)}, ${longitude.toFixed(7)}`,
            building: contactPhone,
            latitude,
            longitude,
            isDefault: true,
          },
        });

        const orderNotes = this.buildOrderNotes(cartItems, itemNotes);
        const order = await this.createOrderWithUniqueNumber(tx, {
          userId,
          addressId: address.id,
          status: OrderStatus.NEW,
          subtotal,
          discountTotal,
          deliveryFee,
          total,
          notes: orderNotes,
        });

        await tx.orderItem.createMany({
          data: cartItems.map((item, index) => {
            const pricing = pricedCartItems[index];

            return {
              orderId: order.id,
              productId: item.productId,
              nameSnapshot: item.product?.nameAr || 'منتج',
              unitPrice: pricing.unitPrice,
              qty: pricing.qty,
              lineTotal: pricing.lineTotal,
            };
          }),
        });

        await tx.orderStatusLog.create({
          data: {
            orderId: order.id,
            status: OrderStatus.NEW,
            note: 'تم إنشاء الطلب.',
          },
        });

        await tx.cartItem.deleteMany({ where: { cartId: cart.id } });

        return tx.order.findUnique({
          where: { id: order.id },
          include: {
            address: true,
            items: {
              include: {
                product: true,
              },
              orderBy: {
                createdAt: 'asc',
              },
            },
          },
        });
      });

      if (!createdOrder) {
        throw new BadRequestException('تعذر إنشاء الطلب. حاول مرة أخرى.');
      }

      const orderTotal = decimalToNumber(createdOrder.total);

      await this.notificationsService.notifyOrderCreatedForCustomer(userId, {
        orderId: createdOrder.id,
        orderNumber: createdOrder.orderNumber,
        total: orderTotal,
      });

      await this.notificationsService.notifyOrderCreatedForAdmins({
        orderId: createdOrder.id,
        orderNumber: createdOrder.orderNumber,
        userId,
        total: orderTotal,
      });

      return {
        order: this.mapUserOrder(createdOrder),
        cart: await this.getCart(userId),
      };
    });
  }

  private resolveCartItemPricing(
    item: {
      productId: string;
      categoryId: string;
      qty: unknown;
      unitPriceSnapshot: unknown;
    },
    exchangeRate: number,
    discountIndex: DiscountIndex,
  ) {
    const qty = roundTo2(decimalToNumber(item.qty));
    const baseUnitPrice = this.toDisplayPrice(item.unitPriceSnapshot, exchangeRate);
    const resolvedDiscount = resolveBestDiscount(
      baseUnitPrice,
      item.productId,
      item.categoryId,
      discountIndex,
    );
    const unitPrice = resolvedDiscount ? resolvedDiscount.finalPrice : baseUnitPrice;
    const lineTotal = roundTo2(unitPrice * qty);
    const baseLineTotal = roundTo2(baseUnitPrice * qty);
    const lineDiscount = roundTo2(Math.max(0, baseLineTotal - lineTotal));

    return {
      qty,
      unitPrice,
      baseUnitPrice,
      lineTotal,
      baseLineTotal,
      lineDiscount,
      discount: resolvedDiscount ? resolvedDiscount.discount : null,
    };
  }

  private async getActiveDiscountIndex(): Promise<DiscountIndex> {
    const now = new Date();
    const activeDiscounts = await this.prisma.discount.findMany({
      where: {
        isActive: true,
        startAt: { lte: now },
        endAt: { gte: now },
      },
      include: {
        targets: true,
      },
    });

    return buildDiscountIndex(activeDiscounts);
  }

  private isDbConnectionError(error: unknown): boolean {
    if (!error || typeof error !== 'object') {
      return false;
    }

    const maybeCode = (error as { code?: string }).code;
    return maybeCode === 'P1001' || maybeCode === 'P1002';
  }

  private async withDbRetry<T>(operation: () => Promise<T>): Promise<T> {
    try {
      return await operation();
    } catch (error) {
      if (!this.isDbConnectionError(error)) {
        throw error;
      }
    }

    await new Promise((resolve) => setTimeout(resolve, 900));

    try {
      return await operation();
    } catch (error) {
      if (this.isDbConnectionError(error)) {
        throw new ServiceUnavailableException(
          'تعذر الاتصال بقاعدة البيانات. حاول مرة ثانية بعد ثوانٍ.',
        );
      }

      throw error;
    }
  }

  private async ensureActiveCart(userId: string) {
    return this.prisma.cart.upsert({
      where: {
        userId_status: {
          userId,
          status: 'ACTIVE',
        },
      },
      update: {},
      create: {
        userId,
        status: 'ACTIVE',
      },
    });
  }

  private async getExchangeRate() {
    const settings = await this.prisma.storeSetting.findUnique({ where: { id: 1 } });
    const rate = decimalToNumber(settings?.usdSarRate);
    return rate > 0 ? rate : 15000;
  }

  private toDisplayPrice(price: unknown, exchangeRate: number) {
    return roundTo2(decimalToNumber(price) * exchangeRate);
  }

  private async createOrderWithUniqueNumber(
    tx: Prisma.TransactionClient,
    data: {
      userId: string;
      addressId: string;
      status: OrderStatus;
      subtotal: number;
      discountTotal: number;
      deliveryFee: number;
      total: number;
      notes?: string | null;
    },
  ) {
    for (let attempt = 0; attempt < 5; attempt += 1) {
      try {
        return await tx.order.create({
          data: {
            orderNumber: this.generateOrderNumber(),
            userId: data.userId,
            addressId: data.addressId,
            status: data.status,
            subtotal: data.subtotal,
            discountTotal: data.discountTotal,
            deliveryFee: data.deliveryFee,
            total: data.total,
            notes: data.notes || null,
          },
        });
      } catch (error) {
        if (
          error instanceof Prisma.PrismaClientKnownRequestError &&
          error.code === 'P2002'
        ) {
          continue;
        }

        throw error;
      }
    }

    throw new BadRequestException('تعذر توليد رقم طلب فريد. حاول مرة أخرى.');
  }

  private generateOrderNumber() {
    const now = new Date();
    const yyyy = now.getFullYear();
    const mm = String(now.getMonth() + 1).padStart(2, '0');
    const dd = String(now.getDate()).padStart(2, '0');
    const random = Math.floor(10000 + Math.random() * 90000);
    return `ARB-${yyyy}${mm}${dd}-${random}`;
  }

  private normalizeCoordinate(value: number, min: number, max: number, label: string) {
    const parsed = Number(value);
    if (!Number.isFinite(parsed) || parsed < min || parsed > max) {
      throw new BadRequestException(`${label} غير صالح.`);
    }

    return Number(parsed.toFixed(7));
  }

  private normalizeItemNotes(raw: unknown): Record<string, string> {
    if (!raw || typeof raw !== 'object' || Array.isArray(raw)) {
      return {};
    }

    const entries = Object.entries(raw as Record<string, unknown>);
    const normalized: Record<string, string> = {};

    entries.forEach(([productId, note]) => {
      const cleanProductId = String(productId || '').trim();
      if (!cleanProductId) return;

      const cleanNote = String(note || '').trim();
      if (!cleanNote) return;

      normalized[cleanProductId] = cleanNote.slice(0, 400);
    });

    return normalized;
  }

  private normalizeOptionalPhone(raw: unknown): string | null {
    const normalized = String(raw ?? '').trim();
    return normalized || null;
  }

  private buildOrderNotes(
    cartItems: Array<{
      productId: string;
      product: { nameAr: string } | null;
    }>,
    itemNotes: Record<string, string>,
  ) {
    const baseNote = 'تم إنشاء الطلب من واجهة العميل.';
    const noteLines: string[] = [];

    cartItems.forEach((item) => {
      const note = itemNotes[item.productId];
      if (!note) return;

      const productName = item.product?.nameAr || 'منتج';
      noteLines.push(`- ${productName}: ${note}`);
    });

    if (!noteLines.length) {
      return baseNote;
    }

    return [baseNote, 'ملاحظات المنتجات:', ...noteLines].join('\n');
  }

  private mapUserOrder(order: {
    id: string;
    orderNumber: string;
    status: OrderStatus;
    createdAt: Date;
    subtotal: unknown;
    discountTotal: unknown;
    deliveryFee: unknown;
    total: unknown;
    notes: string | null;
    address: {
      id: string;
      label: string | null;
      city: string;
      street: string;
      building: string | null;
      latitude: unknown;
      longitude: unknown;
    } | null;
    items: Array<{
      id: string;
      productId: string | null;
      nameSnapshot: string;
      unitPrice: unknown;
      qty: unknown;
      lineTotal: unknown;
      product: {
        imageUrl: string | null;
      } | null;
    }>;
  }) {
    const items = order.items.map((item) => ({
      id: item.id,
      productId: item.productId,
      name: item.nameSnapshot,
      qty: decimalToNumber(item.qty),
      unitPrice: decimalToNumber(item.unitPrice),
      lineTotal: decimalToNumber(item.lineTotal),
      imageUrl: item.product?.imageUrl || null,
    }));

    const itemCount = roundTo2(items.reduce((sum, item) => sum + item.qty, 0));

    return {
      id: order.id,
      orderNumber: order.orderNumber,
      status: order.status,
      createdAt: order.createdAt,
      totals: {
        subtotal: decimalToNumber(order.subtotal),
        discountTotal: decimalToNumber(order.discountTotal),
        deliveryFee: decimalToNumber(order.deliveryFee),
        total: decimalToNumber(order.total),
      },
      notes: order.notes || null,
      itemCount,
      alternatePhone: order.address?.building || null,
      location: order.address
        ? {
            id: order.address.id,
            label: order.address.label || null,
            city: order.address.city,
            street: order.address.street,
            latitude: decimalToNumber(order.address.latitude),
            longitude: decimalToNumber(order.address.longitude),
          }
        : null,
      items,
    };
  }
}
