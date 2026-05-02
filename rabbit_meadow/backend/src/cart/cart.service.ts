import { BadRequestException, Injectable, NotFoundException } from '@nestjs/common';
import { OrderStatus, Prisma } from '@prisma/client';
import { decimalToNumber, roundTo2 } from '../common/utils/decimal.util';
import { PrismaService } from '../prisma/prisma.service';
import { AddCartItemDto } from './dto/add-cart-item.dto';
import { CheckoutCartDto } from './dto/checkout-cart.dto';
import { UpdateCartItemDto } from './dto/update-cart-item.dto';

@Injectable()
export class CartService {
  constructor(private readonly prisma: PrismaService) {}

  async getCart(userId: string) {
    const cart = await this.ensureActiveCart(userId);

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
      const price = decimalToNumber(item.unitPriceSnapshot);
      const qty = decimalToNumber(item.qty);
      return {
        id: item.productId,
        name: item.product.nameAr,
        nameEn: item.product.nameEn,
        imageUrl: item.product.imageUrl,
        price,
        qty,
        total: roundTo2(price * qty),
      };
    });

    const itemCount = items.reduce((sum, item) => sum + item.qty, 0);
    const subtotal = roundTo2(items.reduce((sum, item) => sum + item.total, 0));

    return {
      items,
      itemCount: roundTo2(itemCount),
      subtotal,
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
    const order = await this.prisma.order.findUnique({ where: { id: orderId }, include: { items: true } });
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

      for (const item of order.items) {
        if (!item.productId) continue;

        const product = await tx.product.findUnique({ where: { id: item.productId } });
        const beforeQty = product ? Number(product.stockQty) : 0;
        const qty = Number(item.qty);
        const afterQty = beforeQty + qty;

        await tx.product.update({ where: { id: item.productId }, data: { stockQty: afterQty } });

        await tx.inventoryMovement.create({
          data: {
            productId: item.productId,
            type: 'RETURN',
            qty: qty,
            beforeQty: beforeQty,
            afterQty: afterQty,
            referenceType: 'ORDER',
            referenceId: orderId,
            createdById: userId,
          },
        });
      }

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
    return this.mapUserOrder(updated);
  }

  async checkout(userId: string, payload: CheckoutCartDto) {
    const alternatePhone = String(payload.alternatePhone || '').trim();
    if (!alternatePhone) {
      throw new BadRequestException('رقم الهاتف البديل مطلوب.');
    }

    const latitude = this.normalizeCoordinate(payload.latitude, -90, 90, 'خط العرض');
    const longitude = this.normalizeCoordinate(payload.longitude, -180, 180, 'خط الطول');

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

    const subtotal = roundTo2(
      cartItems.reduce((sum, item) => {
        const unitPrice = decimalToNumber(item.unitPriceSnapshot);
        const qty = decimalToNumber(item.qty);
        return sum + roundTo2(unitPrice * qty);
      }, 0),
    );

    const discountTotal = 0;
    const deliveryFee = 0;
    const total = roundTo2(subtotal - discountTotal + deliveryFee);

    const createdOrder = await this.prisma.$transaction(async (tx) => {
      for (const item of cartItems) {
        if (!item.product || !item.product.isActive) {
          throw new NotFoundException('أحد المنتجات في السلة غير متوفر.');
        }

        const qty = roundTo2(decimalToNumber(item.qty));
        const stockQty = roundTo2(decimalToNumber(item.product.stockQty));

        if (qty <= 0) {
          throw new BadRequestException('يوجد عنصر بكمية غير صالحة في السلة.');
        }

        if (stockQty < qty) {
          throw new BadRequestException(
            `الكمية المطلوبة من "${item.product.nameAr}" أكبر من المخزون المتاح.`,
          );
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
          building: alternatePhone,
          latitude,
          longitude,
          isDefault: true,
        },
      });

      const order = await this.createOrderWithUniqueNumber(tx, {
        userId,
        addressId: address.id,
        status: OrderStatus.NEW,
        subtotal,
        discountTotal,
        deliveryFee,
        total,
        notes: 'تم إنشاء الطلب من واجهة العميل.',
      });

      await tx.orderItem.createMany({
        data: cartItems.map((item) => {
          const unitPrice = roundTo2(decimalToNumber(item.unitPriceSnapshot));
          const qty = roundTo2(decimalToNumber(item.qty));
          const lineTotal = roundTo2(unitPrice * qty);

          return {
            orderId: order.id,
            productId: item.productId,
            nameSnapshot: item.product?.nameAr || 'منتج',
            unitPrice,
            qty,
            lineTotal,
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

      for (const item of cartItems) {
        if (!item.product) continue;

        const qty = roundTo2(decimalToNumber(item.qty));
        const beforeQty = roundTo2(decimalToNumber(item.product.stockQty));
        const afterQty = roundTo2(beforeQty - qty);

        await tx.product.update({
          where: { id: item.product.id },
          data: {
            stockQty: afterQty,
          },
        });

        await tx.inventoryMovement.create({
          data: {
            productId: item.product.id,
            type: 'ORDER_DEDUCT',
            qty,
            beforeQty,
            afterQty,
            referenceType: 'ORDER',
            referenceId: order.id,
            createdById: userId,
          },
        });
      }

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

    return {
      order: this.mapUserOrder(createdOrder),
      cart: await this.getCart(userId),
    };
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

  private mapUserOrder(order: {
    id: string;
    orderNumber: string;
    status: OrderStatus;
    createdAt: Date;
    subtotal: unknown;
    discountTotal: unknown;
    deliveryFee: unknown;
    total: unknown;
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
