import { BadRequestException, Injectable, NotFoundException } from '@nestjs/common';
import { OrderStatus } from '@prisma/client';
import { decimalToNumber } from '../common/utils/decimal.util';
import { NotificationsService } from '../notifications/notifications.service';
import { PrismaService } from '../prisma/prisma.service';
import { UpdateDeliveryOrderStatusDto } from './dto/update-delivery-order-status.dto';

@Injectable()
export class DeliveryService {
  constructor(
    private readonly prisma: PrismaService,
    private readonly notificationsService: NotificationsService,
  ) {}

  async listMyOrders(deliveryUserId: string) {
    const orders = await this.prisma.order.findMany({
      where: {
        assignedDeliveryId: deliveryUserId,
        status: {
          in: [OrderStatus.PREPARING, OrderStatus.ON_THE_WAY, OrderStatus.DELIVERED],
        },
      },
      orderBy: {
        createdAt: 'desc',
      },
      include: {
        user: true,
        address: true,
        items: true,
      },
    });

    return orders.map((order) => this.mapDeliveryOrder(order));
  }

  async getMyOrder(orderId: string, deliveryUserId: string) {
    const order = await this.prisma.order.findUnique({
      where: { id: orderId },
      include: {
        user: true,
        address: true,
        items: true,
        statusLogs: {
          include: {
            changedBy: true,
          },
          orderBy: {
            createdAt: 'desc',
          },
        },
      },
    });

    if (!order || order.assignedDeliveryId !== deliveryUserId) {
      throw new NotFoundException('الطلب غير موجود.');
    }

    return {
      ...this.mapDeliveryOrder(order),
      statusLogs: order.statusLogs.map((log) => ({
        id: log.id,
        status: log.status,
        note: log.note,
        changedBy: log.changedBy?.name || null,
        createdAt: log.createdAt,
      })),
    };
  }

  async updateMyOrderStatus(
    orderId: string,
    deliveryUserId: string,
    payload: UpdateDeliveryOrderStatusDto,
  ) {
    const existing = await this.prisma.order.findUnique({
      where: { id: orderId },
      select: {
        id: true,
        orderNumber: true,
        userId: true,
        status: true,
        assignedDeliveryId: true,
      },
    });

    if (!existing || existing.assignedDeliveryId !== deliveryUserId) {
      throw new NotFoundException('الطلب غير موجود.');
    }

    if (existing.status === payload.status) {
      throw new BadRequestException('الطلب موجود بالفعل على هذه الحالة.');
    }

    const allowedTransitions: Record<OrderStatus, OrderStatus[]> = {
      [OrderStatus.NEW]: [],
      [OrderStatus.PREPARING]: [OrderStatus.ON_THE_WAY],
      [OrderStatus.ON_THE_WAY]: [OrderStatus.DELIVERED],
      [OrderStatus.DELIVERED]: [],
      [OrderStatus.REJECTED]: [],
      [OrderStatus.CANCELLED]: [],
    };

    const nextAllowed = allowedTransitions[existing.status] || [];
    if (!nextAllowed.includes(payload.status)) {
      throw new BadRequestException('لا يمكن تحديث الطلب لهذه الحالة من وضعه الحالي.');
    }

    const defaultNoteByStatus: Record<OrderStatus, string> = {
      [OrderStatus.NEW]: 'تم إنشاء الطلب.',
      [OrderStatus.PREPARING]: 'الطلب قيد التجهيز.',
      [OrderStatus.ON_THE_WAY]: 'الطلب في الطريق.',
      [OrderStatus.DELIVERED]: 'تم تسليم الطلب.',
      [OrderStatus.REJECTED]: 'تم رفض الطلب.',
      [OrderStatus.CANCELLED]: 'تم إلغاء الطلب.',
    };
    const statusNote = payload.note?.trim() || defaultNoteByStatus[payload.status];

    await this.prisma.$transaction(async (tx) => {
      await tx.order.update({
        where: { id: orderId },
        data: {
          status: payload.status,
        },
      });

      await tx.orderStatusLog.create({
        data: {
          orderId,
          status: payload.status,
          changedById: deliveryUserId,
          note: statusNote,
        },
      });
    });

    await this.notificationsService.notifyOrderStatusChangedForCustomer(existing.userId, {
      orderId: existing.id,
      orderNumber: existing.orderNumber,
      status: payload.status,
      note: statusNote,
    });

    if (payload.status === OrderStatus.DELIVERED) {
      await this.notificationsService.notifyOrderDeliveredForAdmins({
        orderId: existing.id,
        orderNumber: existing.orderNumber,
        userId: existing.userId,
      });
    }

    return this.getMyOrder(orderId, deliveryUserId);
  }

  private mapDeliveryOrder(order: {
    id: string;
    orderNumber: string;
    status: OrderStatus;
    prepMinutes: number | null;
    createdAt: Date;
    subtotal: unknown;
    discountTotal: unknown;
    deliveryFee: unknown;
    total: unknown;
    notes: string | null;
    user: { id: string; name: string; phone: string };
    address: {
      id: string;
      city: string;
      street: string;
      building: string | null;
      label: string | null;
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
    }>;
  }) {
    return {
      id: order.id,
      orderNumber: order.orderNumber,
      status: order.status,
      prepMinutes: order.prepMinutes,
      createdAt: order.createdAt,
      customer: {
        id: order.user.id,
        name: order.user.name,
        phone: order.user.phone,
      },
      address: order.address
        ? {
            id: order.address.id,
            city: order.address.city,
            street: order.address.street,
            building: order.address.building,
            label: order.address.label,
            latitude: decimalToNumber(order.address.latitude),
            longitude: decimalToNumber(order.address.longitude),
          }
        : null,
      totals: {
        subtotal: decimalToNumber(order.subtotal),
        discountTotal: decimalToNumber(order.discountTotal),
        deliveryFee: decimalToNumber(order.deliveryFee),
        total: decimalToNumber(order.total),
      },
      notes: order.notes,
      items: order.items.map((item) => ({
        id: item.id,
        productId: item.productId,
        name: item.nameSnapshot,
        unitPrice: decimalToNumber(item.unitPrice),
        qty: decimalToNumber(item.qty),
        lineTotal: decimalToNumber(item.lineTotal),
      })),
    };
  }
}
