import { BadRequestException, Injectable, NotFoundException } from '@nestjs/common';
import { PrismaService } from '../prisma/prisma.service';
import { decimalToNumber, roundTo2 } from '../common/utils/decimal.util';
import { AddCartItemDto } from './dto/add-cart-item.dto';
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
}
