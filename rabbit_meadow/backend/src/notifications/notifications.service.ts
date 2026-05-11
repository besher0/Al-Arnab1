import { Injectable, NotFoundException } from '@nestjs/common';
import {
  NotificationType,
  OrderStatus,
  Prisma,
  UserRole,
} from '@prisma/client';
import { PrismaService } from '../prisma/prisma.service';
import { AdminNotificationAudience, CreateAdminNotificationDto } from './dto/create-admin-notification.dto';
import { ListNotificationsQueryDto } from './dto/list-notifications-query.dto';
import { RegisterDeviceTokenDto } from './dto/register-device-token.dto';
import { FirebasePushService } from './firebase-push.service';

type OrderNotificationInput = {
  orderId: string;
  orderNumber: string;
};

type StatusNotificationInput = OrderNotificationInput & {
  status: OrderStatus;
  note?: string | null;
};

type DeliveryAssignmentNotificationInput = OrderNotificationInput & {
  prepMinutes?: number | null;
  customerName?: string | null;
};

type CreateNotificationInput = {
  title: string;
  body: string;
  type?: NotificationType;
  metadata?: Prisma.InputJsonValue;
};

const ORDER_STATUS_LABELS: Record<OrderStatus, string> = {
  [OrderStatus.NEW]: 'جديد',
  [OrderStatus.PREPARING]: 'قيد التحضير',
  [OrderStatus.ON_THE_WAY]: 'في الطريق',
  [OrderStatus.DELIVERED]: 'تم التسليم',
  [OrderStatus.REJECTED]: 'مرفوض',
  [OrderStatus.CANCELLED]: 'ملغي',
};

@Injectable()
export class NotificationsService {
  constructor(
    private readonly prisma: PrismaService,
    private readonly firebasePushService: FirebasePushService,
  ) {}

  async registerDeviceToken(userId: string, payload: RegisterDeviceTokenDto) {
    const token = payload.token.trim();

    await this.prisma.userDeviceToken.upsert({
      where: { token },
      update: {
        userId,
        isActive: true,
        platform: payload.platform?.trim() || null,
        deviceName: payload.deviceName?.trim() || null,
      },
      create: {
        userId,
        token,
        isActive: true,
        platform: payload.platform?.trim() || null,
        deviceName: payload.deviceName?.trim() || null,
      },
    });

    return { success: true };
  }

  async listMyNotifications(userId: string, query: ListNotificationsQueryDto) {
    const limit = query.limit ?? 30;
    const unreadOnly = Boolean(query.unreadOnly);

    const notifications = await this.prisma.appNotification.findMany({
      where: {
        recipientId: userId,
        ...(unreadOnly ? { isRead: false } : {}),
      },
      orderBy: { createdAt: 'desc' },
      take: limit,
    });

    return notifications.map((notification) => ({
      id: notification.id,
      title: notification.title,
      body: notification.body,
      type: notification.type,
      isRead: notification.isRead,
      readAt: notification.readAt,
      metadata: notification.metadata,
      createdAt: notification.createdAt,
    }));
  }

  async unreadCount(userId: string) {
    const count = await this.prisma.appNotification.count({
      where: {
        recipientId: userId,
        isRead: false,
      },
    });

    return { unreadCount: count };
  }

  async markAsRead(userId: string, notificationId: string) {
    const updated = await this.prisma.appNotification.updateMany({
      where: {
        id: notificationId,
        recipientId: userId,
      },
      data: {
        isRead: true,
        readAt: new Date(),
      },
    });

    if (!updated.count) {
      throw new NotFoundException('الإشعار غير موجود.');
    }

    return { success: true };
  }

  async markAllAsRead(userId: string) {
    const result = await this.prisma.appNotification.updateMany({
      where: {
        recipientId: userId,
        isRead: false,
      },
      data: {
        isRead: true,
        readAt: new Date(),
      },
    });

    return { updatedCount: result.count };
  }

  async createAdminBroadcast(adminId: string, payload: CreateAdminNotificationDto) {
    const audience = payload.audience || AdminNotificationAudience.CUSTOMERS;
    const targetPhone = String(payload.targetPhone || '').trim();
    const recipientIds = targetPhone
      ? await this.resolveAudienceUserIdsByPhone(audience, targetPhone)
      : await this.resolveAudienceUserIds(audience);

    if (targetPhone && !recipientIds.length) {
      throw new NotFoundException('لا يوجد مستخدم نشط بهذا الرقم.');
    }

    const result = await this.createForUsers(recipientIds, {
      title: payload.title.trim(),
      body: payload.body.trim(),
      type: NotificationType.GENERAL,
      metadata: {
        source: 'ADMIN_BROADCAST',
        sentBy: adminId,
        audience,
        targetPhone: targetPhone || null,
      },
    });

    return {
      audience,
      targetPhone: targetPhone || null,
      recipients: result.recipients,
      push: result.push,
    };
  }

  async notifyOrderCreatedForCustomer(
    userId: string,
    order: OrderNotificationInput & { total?: number },
  ) {
    const totalText = Number.isFinite(order.total)
      ? ` بقيمة ${Number(order.total).toFixed(2)}`
      : '';

    return this.createForUsers([userId], {
      title: `تم استلام طلبك #${order.orderNumber}`,
      body: `شكراً لك، طلبك قيد المعالجة${totalText}.`,
      type: NotificationType.ORDER_CREATED,
      metadata: {
        orderId: order.orderId,
        orderNumber: order.orderNumber,
        status: OrderStatus.NEW,
      },
    });
  }

  async notifyOrderCreatedForAdmins(order: OrderNotificationInput & { total?: number; userId?: string }) {
    const adminIds = await this.resolveAudienceUserIds(AdminNotificationAudience.ADMINS);
    if (!adminIds.length) return { recipients: 0, push: this.emptyPushResult() };

    const totalText = Number.isFinite(order.total)
      ? ` بقيمة ${Number(order.total).toFixed(2)}`
      : '';

    return this.createForUsers(adminIds, {
      title: `طلب جديد #${order.orderNumber}`,
      body: `وصل طلب جديد${totalText}.`,
      type: NotificationType.ORDER_CREATED,
      metadata: {
        orderId: order.orderId,
        orderNumber: order.orderNumber,
        userId: order.userId || null,
        status: OrderStatus.NEW,
      },
    });
  }

  async notifyOrderAssignedToDelivery(
    deliveryUserId: string,
    input: DeliveryAssignmentNotificationInput,
  ) {
    const prepMinutes = Number(input.prepMinutes);
    const hasPrepMinutes =
      input.prepMinutes !== null &&
      input.prepMinutes !== undefined &&
      Number.isFinite(prepMinutes) &&
      prepMinutes >= 0;
    const prepLabel = hasPrepMinutes ? ` - وقت التجهيز: ${prepMinutes} دقيقة` : '';
    const customerLabel = input.customerName?.trim() ? ` للعميل ${input.customerName.trim()}` : '';

    return this.createForUsers([deliveryUserId], {
      title: `تم تحويل طلب جديد #${input.orderNumber}`,
      body: `لديك طلب جديد${customerLabel}${prepLabel}.`,
      type: NotificationType.ORDER_STATUS,
      metadata: {
        orderId: input.orderId,
        orderNumber: input.orderNumber,
        status: OrderStatus.PREPARING,
      },
    });
  }

  async notifyOrderStatusChangedForCustomer(userId: string, input: StatusNotificationInput) {
    const statusLabel = ORDER_STATUS_LABELS[input.status] || input.status;
    const notePart = input.note ? ` - ${input.note}` : '';

    return this.createForUsers([userId], {
      title: `تحديث طلب #${input.orderNumber}`,
      body: `حالة الطلب أصبحت: ${statusLabel}${notePart}`,
      type: input.status === OrderStatus.DELIVERED ? NotificationType.ORDER_DELIVERED : NotificationType.ORDER_STATUS,
      metadata: {
        orderId: input.orderId,
        orderNumber: input.orderNumber,
        status: input.status,
        note: input.note || null,
      },
    });
  }

  async notifyOrderDeliveredForAdmins(order: OrderNotificationInput & { userId?: string }) {
    const adminIds = await this.resolveAudienceUserIds(AdminNotificationAudience.ADMINS);
    if (!adminIds.length) return { recipients: 0, push: this.emptyPushResult() };

    return this.createForUsers(adminIds, {
      title: `تم تسليم الطلب #${order.orderNumber}`,
      body: 'تم تأكيد تسليم الطلب بنجاح.',
      type: NotificationType.ORDER_DELIVERED,
      metadata: {
        orderId: order.orderId,
        orderNumber: order.orderNumber,
        userId: order.userId || null,
        status: OrderStatus.DELIVERED,
      },
    });
  }

  async notifyOrderCancelledForAdmins(order: OrderNotificationInput & { userId?: string }) {
    const adminIds = await this.resolveAudienceUserIds(AdminNotificationAudience.ADMINS);
    if (!adminIds.length) return { recipients: 0, push: this.emptyPushResult() };

    return this.createForUsers(adminIds, {
      title: `تم إرجاع الطلب #${order.orderNumber}`,
      body: 'العميل قام بإرجاع الطلب.',
      type: NotificationType.ORDER_STATUS,
      metadata: {
        orderId: order.orderId,
        orderNumber: order.orderNumber,
        userId: order.userId || null,
        status: OrderStatus.CANCELLED,
      },
    });
  }

  private async createForUsers(recipientIds: string[], input: CreateNotificationInput) {
    const uniqueRecipients = Array.from(
      new Set(
        recipientIds
          .map((id) => String(id || '').trim())
          .filter(Boolean),
      ),
    );

    if (!uniqueRecipients.length) {
      return {
        recipients: 0,
        push: this.emptyPushResult(),
      };
    }

    await this.prisma.appNotification.createMany({
      data: uniqueRecipients.map((recipientId) => ({
        recipientId,
        title: input.title,
        body: input.body,
        type: input.type || NotificationType.GENERAL,
        metadata: input.metadata ?? Prisma.JsonNull,
      })),
    });

    const tokenRows = await this.prisma.userDeviceToken.findMany({
      where: {
        userId: { in: uniqueRecipients },
        isActive: true,
      },
      select: {
        token: true,
      },
    });

    const push = await this.firebasePushService.sendToTokens(
      tokenRows.map((row) => row.token),
      {
        title: input.title,
        body: input.body,
        data: {
          type: input.type || NotificationType.GENERAL,
          ...(this.buildMetadataData(input.metadata) || {}),
          link: '/profile',
        },
      },
    );

    if (push.invalidTokens.length) {
      await this.prisma.userDeviceToken.updateMany({
        where: {
          token: {
            in: push.invalidTokens,
          },
        },
        data: {
          isActive: false,
        },
      });
    }

    return {
      recipients: uniqueRecipients.length,
      push,
    };
  }

  private buildMetadataData(metadata?: Prisma.InputJsonValue) {
    if (!metadata || typeof metadata !== 'object' || Array.isArray(metadata)) {
      return null;
    }

    const data: Record<string, string> = {};
    Object.entries(metadata).forEach(([key, value]) => {
      if (value === null || value === undefined) return;
      data[`meta_${key}`] = String(value);
    });
    return data;
  }

  private async resolveAudienceUserIds(audience: AdminNotificationAudience) {
    let roleFilter: UserRole[] | null = null;

    if (audience === AdminNotificationAudience.CUSTOMERS) {
      roleFilter = [UserRole.CUSTOMER];
    } else if (audience === AdminNotificationAudience.ADMINS) {
      roleFilter = [UserRole.ADMIN];
    }

    const users = await this.prisma.user.findMany({
      where: {
        isActive: true,
        ...(roleFilter ? { role: { in: roleFilter } } : {}),
      },
      select: {
        id: true,
      },
    });

    return users.map((user) => user.id);
  }

  private async resolveAudienceUserIdsByPhone(
    audience: AdminNotificationAudience,
    targetPhone: string,
  ) {
    const normalizedTarget = this.normalizePhoneValue(targetPhone);
    if (!normalizedTarget) {
      return [];
    }

    let roleFilter: UserRole[] | null = null;
    if (audience === AdminNotificationAudience.CUSTOMERS) {
      roleFilter = [UserRole.CUSTOMER];
    } else if (audience === AdminNotificationAudience.ADMINS) {
      roleFilter = [UserRole.ADMIN];
    }

    const users = await this.prisma.user.findMany({
      where: {
        isActive: true,
        ...(roleFilter ? { role: { in: roleFilter } } : {}),
      },
      select: {
        id: true,
        phone: true,
      },
    });

    return users
      .filter((user) => this.normalizePhoneValue(user.phone) === normalizedTarget)
      .map((user) => user.id);
  }

  private normalizePhoneValue(raw: string) {
    return String(raw || '').replace(/[^\d+]/g, '');
  }

  private emptyPushResult() {
    return {
      attemptedTokens: 0,
      successCount: 0,
      failureCount: 0,
      invalidTokens: [] as string[],
    };
  }
}
