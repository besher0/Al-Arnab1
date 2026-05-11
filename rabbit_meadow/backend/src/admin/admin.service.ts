import { BadRequestException, Injectable, NotFoundException } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import { OrderStatus, UserRole } from '@prisma/client';
import { createHash } from 'node:crypto';
import { decimalToNumber, roundTo2 } from '../common/utils/decimal.util';
import { PrismaService } from '../prisma/prisma.service';
import { CreateCategoryDto } from './dto/create-category.dto';
import { CreateDiscountDto } from './dto/create-discount.dto';
import { CreateProductDto } from './dto/create-product.dto';
import { SalesReportQueryDto } from './dto/sales-report-query.dto';
import { UpdateOrderStatusDto } from './dto/update-order-status.dto';
import { UpdateStoreSettingDto } from './dto/update-store-setting.dto';
import { CreateAdminNotificationDto } from '../notifications/dto/create-admin-notification.dto';
import { NotificationsService } from '../notifications/notifications.service';
import { UpdateCategoryDto } from './dto/update-category.dto';

@Injectable()
export class AdminService {
  constructor(
    private readonly prisma: PrismaService,
    private readonly configService: ConfigService,
    private readonly notificationsService: NotificationsService,
  ) {}

  async getDashboard() {
    const now = new Date();
    const dayStart = new Date(now);
    dayStart.setHours(0, 0, 0, 0);

    const [settings, salesAggregate, activeOrdersCount, productStockRows, latestOrders] =
      await Promise.all([
        this.ensureStoreSettings(),
        this.prisma.order.aggregate({
          where: {
            status: OrderStatus.DELIVERED,
            createdAt: { gte: dayStart },
          },
          _sum: { total: true },
        }),
        this.prisma.order.count({
          where: {
            status: { in: [OrderStatus.NEW, OrderStatus.PREPARING, OrderStatus.ON_THE_WAY] },
          },
        }),
        this.prisma.product.findMany({
          where: { isActive: true },
          select: {
            stockQty: true,
            minStock: true,
          },
        }),
        this.prisma.order.findMany({
          orderBy: { createdAt: 'desc' },
          take: 5,
          include: {
            user: true,
          },
        }),
      ]);

    const outOfStockCount = productStockRows.filter(
      (row) => decimalToNumber(row.stockQty) <= decimalToNumber(row.minStock),
    ).length;

    return {
      store: {
        isOpen: settings.isOpen,
        currency: settings.currency,
        usdSarRate: decimalToNumber(settings.usdSarRate),
      },
      metrics: {
        dailySales: decimalToNumber(salesAggregate._sum.total),
        activeOrders: activeOrdersCount,
        lowStockProducts: outOfStockCount,
      },
      latestOrders: latestOrders.map((order) => ({
        id: order.id,
        orderNumber: order.orderNumber,
        customerName: order.user.name,
        status: order.status,
        total: decimalToNumber(order.total),
        createdAt: order.createdAt,
      })),
    };
  }

  async listCurrentOrders() {
    const orders = await this.prisma.order.findMany({
      where: {
        status: {
          in: [OrderStatus.NEW, OrderStatus.PREPARING, OrderStatus.ON_THE_WAY],
        },
      },
      orderBy: { createdAt: 'desc' },
      include: {
        user: true,
        address: true,
        assignedDelivery: true,
      },
    });

    return orders.map((order) => this.mapOrderSummary(order));
  }

  async listDeliveryUsers() {
    const deliveryUsers = await this.listActiveDeliveryUsersWithLoad();

    return deliveryUsers.map((deliveryUser) => ({
      id: deliveryUser.id,
      name: deliveryUser.name,
      phone: deliveryUser.phone,
      activeOrdersCount: deliveryUser.activeOrdersCount,
    }));
  }

  async listCompletedOrders() {
    const orders = await this.prisma.order.findMany({
      where: {
        status: OrderStatus.DELIVERED,
      },
      orderBy: { createdAt: 'desc' },
      include: {
        user: true,
        address: true,
        assignedDelivery: true,
      },
    });

    return orders.map((order) => this.mapOrderSummary(order));
  }

  async getOrderDetail(id: string) {
    const order = await this.prisma.order.findUnique({
      where: { id },
      include: {
        user: true,
        address: true,
        assignedDelivery: true,
        items: true,
        statusLogs: {
          include: {
            changedBy: true,
          },
          orderBy: { createdAt: 'desc' },
        },
      },
    });

    if (!order) {
      throw new NotFoundException('الطلب غير موجود.');
    }

    return {
      id: order.id,
      orderNumber: order.orderNumber,
      status: order.status,
      customer: {
        id: order.user.id,
        name: order.user.name,
        phone: order.user.phone,
      },
      assignedDelivery: order.assignedDelivery
        ? {
            id: order.assignedDelivery.id,
            name: order.assignedDelivery.name,
            phone: order.assignedDelivery.phone,
          }
        : null,
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
      prepMinutes: order.prepMinutes,
      rejectReason: order.rejectReason,
      notes: order.notes,
      createdAt: order.createdAt,
      items: order.items.map((item) => ({
        id: item.id,
        productId: item.productId,
        name: item.nameSnapshot,
        unitPrice: decimalToNumber(item.unitPrice),
        qty: decimalToNumber(item.qty),
        lineTotal: decimalToNumber(item.lineTotal),
      })),
      statusLogs: order.statusLogs.map((log) => ({
        id: log.id,
        status: log.status,
        note: log.note,
        changedBy: log.changedBy?.name || null,
        createdAt: log.createdAt,
      })),
    };
  }

  async updateOrderStatus(orderId: string, payload: UpdateOrderStatusDto, changedById: string) {
    const existing = await this.prisma.order.findUnique({
      where: { id: orderId },
      include: {
        user: {
          select: {
            name: true,
          },
        },
      },
    });
    if (!existing) {
      throw new NotFoundException('الطلب غير موجود.');
    }

    if (payload.status === OrderStatus.REJECTED && !payload.rejectReason?.trim()) {
      throw new BadRequestException('يجب إرسال سبب الرفض.');
    }

    const allowedTransitions: Record<OrderStatus, OrderStatus[]> = {
      [OrderStatus.NEW]: [OrderStatus.PREPARING, OrderStatus.REJECTED],
      [OrderStatus.PREPARING]: [],
      [OrderStatus.ON_THE_WAY]: [],
      [OrderStatus.DELIVERED]: [],
      [OrderStatus.REJECTED]: [],
      [OrderStatus.CANCELLED]: [],
    };

    if (existing.status !== payload.status) {
      const nextAllowed = allowedTransitions[existing.status] || [];
      if (!nextAllowed.includes(payload.status)) {
        throw new BadRequestException('لا يمكن تحديث الطلب لهذه الحالة من وضعه الحالي.');
      }
    }

    const statusChanged = existing.status !== payload.status;
    const shouldAssignDelivery =
      existing.status === OrderStatus.NEW && payload.status === OrderStatus.PREPARING;
    const assignedDelivery = shouldAssignDelivery
      ? await this.requireActiveDeliveryAssignee(payload.assignedDeliveryId)
      : null;
    const logNote =
      payload.note?.trim() ||
      (assignedDelivery ? `تم تعيين الطلب للمندوب ${assignedDelivery.name}.` : null);

    await this.prisma.$transaction(async (tx) => {
      const nextAssignedDeliveryId =
        payload.status === OrderStatus.REJECTED ? null : assignedDelivery?.id;

      await tx.order.update({
        where: { id: orderId },
        data: {
          status: payload.status,
          prepMinutes: payload.prepMinutes,
          rejectReason: payload.status === OrderStatus.REJECTED ? payload.rejectReason?.trim() : null,
          ...(nextAssignedDeliveryId !== undefined
            ? { assignedDeliveryId: nextAssignedDeliveryId }
            : {}),
        },
      });

      await tx.orderStatusLog.create({
        data: {
          orderId,
          status: payload.status,
          changedById,
          note: logNote,
        },
      });
    });

    if (statusChanged) {
      const note = payload.note?.trim() || payload.rejectReason?.trim() || null;

      await this.notificationsService.notifyOrderStatusChangedForCustomer(existing.userId, {
        orderId: existing.id,
        orderNumber: existing.orderNumber,
        status: payload.status,
        note,
      });

      if (payload.status === OrderStatus.PREPARING && assignedDelivery) {
        await this.notificationsService.notifyOrderAssignedToDelivery(assignedDelivery.id, {
          orderId: existing.id,
          orderNumber: existing.orderNumber,
          customerName: existing.user?.name || null,
          prepMinutes: payload.prepMinutes ?? null,
        });
      }
    }

    return this.getOrderDetail(orderId);
  }

  async createAdminNotification(payload: CreateAdminNotificationDto, adminId: string) {
    return this.notificationsService.createAdminBroadcast(adminId, payload);
  }

  async listCategories() {
    return this.prisma.category.findMany({
      orderBy: [{ sortOrder: 'asc' }, { createdAt: 'asc' }],
    });
  }

  async createCategory(payload: CreateCategoryDto) {
    return this.prisma.category.upsert({
      where: { slug: payload.slug },
      update: {
        nameAr: payload.nameAr,
        nameEn: payload.nameEn,
        imageUrl: payload.imageUrl,
        description: payload.description,
        sortOrder: payload.sortOrder ?? 0,
        isActive: payload.isActive ?? true,
      },
      create: {
        slug: payload.slug,
        nameAr: payload.nameAr,
        nameEn: payload.nameEn,
        imageUrl: payload.imageUrl,
        description: payload.description,
        sortOrder: payload.sortOrder ?? 0,
        isActive: payload.isActive ?? true,
      },
    });
  }

  async updateCategory(categoryId: string, payload: UpdateCategoryDto) {
    const existing = await this.prisma.category.findUnique({
      where: { id: categoryId },
    });
    if (!existing) {
      throw new NotFoundException('التصنيف غير موجود.');
    }

    return this.prisma.category.update({
      where: { id: categoryId },
      data: {
        ...(payload.slug ? { slug: payload.slug } : {}),
        ...(payload.nameAr ? { nameAr: payload.nameAr } : {}),
        ...(payload.nameEn !== undefined ? { nameEn: payload.nameEn || null } : {}),
        ...(payload.imageUrl !== undefined ? { imageUrl: payload.imageUrl || null } : {}),
        ...(payload.description !== undefined ? { description: payload.description || null } : {}),
        ...(payload.sortOrder !== undefined ? { sortOrder: payload.sortOrder } : {}),
        ...(payload.isActive !== undefined ? { isActive: payload.isActive } : {}),
      },
    });
  }

  async deleteCategory(categoryId: string) {
    const existing = await this.prisma.category.findUnique({
      where: { id: categoryId },
      select: { id: true },
    });
    if (!existing) {
      throw new NotFoundException('التصنيف غير موجود.');
    }

    await this.prisma.$transaction([
      this.prisma.category.update({
        where: { id: categoryId },
        data: { isActive: false },
      }),
      this.prisma.product.updateMany({
        where: { categoryId },
        data: {
          isActive: false,
          isNew: false,
        },
      }),
    ]);

    return { success: true, id: categoryId };
  }

  async listProducts() {
    const products = await this.prisma.product.findMany({
      include: { category: true },
      orderBy: { createdAt: 'desc' },
    });

    return products.map((product) => ({
      id: product.id,
      nameAr: product.nameAr,
      categoryId: product.categoryId,
      categoryName: product.category.nameAr,
      unit: product.unit,
      sellPrice: decimalToNumber(product.sellPrice),
      costPrice: decimalToNumber(product.costPrice),
      stockQty: decimalToNumber(product.stockQty),
      minStock: decimalToNumber(product.minStock),
      isActive: product.isActive,
      isNew: product.isNew,
      imageUrl: product.imageUrl,
      createdAt: product.createdAt,
    }));
  }

  async createProduct(payload: CreateProductDto, createdById: string) {
    const category = await this.prisma.category.findUnique({
      where: { id: payload.categoryId },
    });

    if (!category) {
      throw new NotFoundException('التصنيف غير موجود.');
    }

    const product = await this.prisma.product.upsert({
      where: { id: payload.id },
      update: {
        categoryId: payload.categoryId,
        nameAr: payload.nameAr,
        nameEn: payload.nameEn,
        description: payload.description,
        sku: payload.sku,
        unit: payload.unit,
        sellPrice: payload.sellPrice,
        costPrice: payload.costPrice,
        stockQty: payload.stockQty,
        minStock: payload.minStock,
        imageUrl: payload.imageUrl,
        ...(payload.isNew !== undefined ? { isNew: payload.isNew } : {}),
        isActive: payload.isActive ?? true,
      },
      create: {
        id: payload.id,
        categoryId: payload.categoryId,
        nameAr: payload.nameAr,
        nameEn: payload.nameEn,
        description: payload.description,
        sku: payload.sku,
        unit: payload.unit,
        sellPrice: payload.sellPrice,
        costPrice: payload.costPrice,
        stockQty: payload.stockQty,
        minStock: payload.minStock,
        imageUrl: payload.imageUrl,
        isNew: payload.isNew ?? false,
        isActive: payload.isActive ?? true,
      },
    });

    await this.prisma.inventoryMovement.create({
      data: {
        productId: product.id,
        type: 'ADJUST',
        qty: payload.stockQty,
        beforeQty: 0,
        afterQty: payload.stockQty,
        referenceType: 'ADMIN_CREATE_PRODUCT',
        referenceId: product.id,
        createdById,
      },
    });

    return product;
  }

  async deleteProduct(productId: string) {
    const existing = await this.prisma.product.findUnique({
      where: { id: productId },
      select: { id: true },
    });
    if (!existing) {
      throw new NotFoundException('المنتج غير موجود.');
    }

    await this.prisma.product.update({
      where: { id: productId },
      data: {
        isActive: false,
        isNew: false,
      },
    });

    return { success: true, id: productId };
  }

  async updateProductNewStatus(productId: string, isNew: boolean) {
    const existing = await this.prisma.product.findUnique({
      where: { id: productId },
    });

    if (!existing) {
      throw new NotFoundException('المنتج غير موجود.');
    }

    const updated = await this.prisma.product.update({
      where: { id: productId },
      data: { isNew },
      include: { category: true },
    });

    return {
      id: updated.id,
      nameAr: updated.nameAr,
      categoryId: updated.categoryId,
      categoryName: updated.category.nameAr,
      unit: updated.unit,
      sellPrice: decimalToNumber(updated.sellPrice),
      costPrice: decimalToNumber(updated.costPrice),
      stockQty: decimalToNumber(updated.stockQty),
      minStock: decimalToNumber(updated.minStock),
      isActive: updated.isActive,
      isNew: updated.isNew,
      imageUrl: updated.imageUrl,
      createdAt: updated.createdAt,
    };
  }

  async createDiscount(payload: CreateDiscountDto, adminId: string) {
    if (new Date(payload.endAt).getTime() <= new Date(payload.startAt).getTime()) {
      throw new BadRequestException('تاريخ النهاية يجب أن يكون بعد تاريخ البداية.');
    }

    const discount = await this.prisma.discount.create({
      data: {
        title: payload.title,
        description: payload.description,
        bannerUrl: payload.bannerUrl,
        type: payload.type,
        value: payload.value,
        startAt: new Date(payload.startAt),
        endAt: new Date(payload.endAt),
        isActive: payload.isActive ?? true,
        createdById: adminId,
      },
    });

    await this.prisma.discountTarget.createMany({
      data: payload.targetIds.map((targetId) => ({
        discountId: discount.id,
        targetType: payload.targetType,
        productId: payload.targetType === 'PRODUCT' ? targetId : null,
        categoryId: payload.targetType === 'CATEGORY' ? targetId : null,
      })),
    });

    return {
      id: discount.id,
      title: discount.title,
      type: discount.type,
      value: decimalToNumber(discount.value),
      startAt: discount.startAt,
      endAt: discount.endAt,
      isActive: discount.isActive,
      targetType: payload.targetType,
      targetIds: payload.targetIds,
    };
  }

  async listDiscounts() {
    const discounts = await this.prisma.discount.findMany({
      include: {
        targets: {
          include: {
            product: true,
            category: true,
          },
        },
      },
      orderBy: [{ createdAt: 'desc' }],
    });

    return discounts.map((discount) => {
      const targets = discount.targets.map((target) => ({
        id: target.id,
        targetType: target.targetType,
        productId: target.productId,
        productName: target.product?.nameAr || null,
        categoryId: target.categoryId,
        categoryName: target.category?.nameAr || null,
      }));

      return {
        id: discount.id,
        title: discount.title,
        description: discount.description,
        type: discount.type,
        value: decimalToNumber(discount.value),
        startAt: discount.startAt,
        endAt: discount.endAt,
        isActive: discount.isActive,
        createdAt: discount.createdAt,
        targetType: targets.length ? targets[0].targetType : null,
        targetIds: targets
          .map((target) => target.productId || target.categoryId || '')
          .filter((value) => Boolean(value)),
        targets,
      };
    });
  }

  async getStoreSettings() {
    const settings = await this.ensureStoreSettings();

    return {
      id: settings.id,
      isOpen: settings.isOpen,
      currency: settings.currency,
      usdSarRate: decimalToNumber(settings.usdSarRate),
      updatedAt: settings.updatedAt,
    };
  }

  async updateStoreSettings(payload: UpdateStoreSettingDto, updatedById: string) {
    await this.ensureStoreSettings();

    if (payload.usdSarRate !== undefined) {
      const nextRate = Number(payload.usdSarRate);
      if (!Number.isFinite(nextRate) || nextRate <= 0) {
        throw new BadRequestException('سعر الصرف يجب أن يكون أكبر من الصفر.');
      }
    }

    const settings = await this.prisma.storeSetting.update({
      where: { id: 1 },
      data: {
        ...(payload.isOpen !== undefined ? { isOpen: payload.isOpen } : {}),
        ...(payload.currency ? { currency: payload.currency } : {}),
        ...(payload.usdSarRate !== undefined ? { usdSarRate: payload.usdSarRate } : {}),
        updatedById,
      },
    });

    return {
      id: settings.id,
      isOpen: settings.isOpen,
      currency: settings.currency,
      usdSarRate: decimalToNumber(settings.usdSarRate),
      updatedAt: settings.updatedAt,
    };
  }

  async salesReport(query: SalesReportQueryDto) {
    const toDate = query.to ? new Date(query.to) : new Date();
    const fromDate = query.from
      ? new Date(query.from)
      : new Date(toDate.getFullYear(), toDate.getMonth(), 1);

    if (fromDate.getTime() > toDate.getTime()) {
      throw new BadRequestException('تاريخ البداية يجب أن يكون قبل تاريخ النهاية.');
    }

    const orders = await this.prisma.order.findMany({
      where: {
        createdAt: {
          gte: fromDate,
          lte: toDate,
        },
        status: OrderStatus.DELIVERED,
      },
      include: {
        items: {
          include: {
            product: true,
          },
        },
      },
      orderBy: {
        createdAt: 'desc',
      },
    });

    const revenue = roundTo2(
      orders.reduce((sum, order) => sum + decimalToNumber(order.total), 0),
    );

    const cost = roundTo2(
      orders.reduce((sum, order) => {
        const orderCost = order.items.reduce((itemSum, item) => {
          const qty = decimalToNumber(item.qty);
          const costPrice = decimalToNumber(item.product?.costPrice);
          return itemSum + qty * costPrice;
        }, 0);

        return sum + orderCost;
      }, 0),
    );

    const grossProfit = roundTo2(revenue - cost);

    return {
      from: fromDate,
      to: toDate,
      totals: {
        revenue,
        cost,
        grossProfit,
        ordersCount: orders.length,
      },
      operations: orders.slice(0, 20).map((order) => ({
        id: order.id,
        orderNumber: order.orderNumber,
        total: decimalToNumber(order.total),
        status: order.status,
        createdAt: order.createdAt,
      })),
    };
  }

  getCloudinaryUploadSignature() {
    const cloudName = this.configService.get<string>('CLOUDINARY_CLOUD_NAME', '').trim();
    const apiKey = this.configService.get<string>('CLOUDINARY_API_KEY', '').trim();
    const apiSecret = this.configService.get<string>('CLOUDINARY_API_SECRET', '').trim();
    const folder = this.configService
      .get<string>('CLOUDINARY_UPLOAD_FOLDER', 'al-arnab')
      .trim();

    if (!cloudName || !apiKey || !apiSecret) {
      throw new BadRequestException(
        'إعدادات Cloudinary غير مكتملة. تأكد من CLOUDINARY_CLOUD_NAME وCLOUDINARY_API_KEY وCLOUDINARY_API_SECRET.',
      );
    }

    const timestamp = Math.floor(Date.now() / 1000);
    const paramsToSign = `folder=${folder}&timestamp=${timestamp}`;
    const signature = createHash('sha1')
      .update(`${paramsToSign}${apiSecret}`)
      .digest('hex');

    return {
      cloudName,
      apiKey,
      timestamp,
      folder,
      signature,
      uploadUrl: `https://api.cloudinary.com/v1_1/${cloudName}/image/upload`,
    };
  }

  private async ensureStoreSettings() {
    return this.prisma.storeSetting.upsert({
      where: { id: 1 },
      update: {},
      create: {
        id: 1,
        isOpen: true,
        currency: 'SYP',
        usdSarRate: 15000,
      },
    });
  }

  private mapOrderSummary(order: {
    id: string;
    orderNumber: string;
    status: OrderStatus;
    total: unknown;
    createdAt: Date;
    user: { id: string; name: string; phone: string };
    assignedDelivery?: { id: string; name: string; phone: string } | null;
    address?: {
      id: string;
      city: string;
      street: string;
      building: string | null;
      label: string | null;
      latitude: unknown;
      longitude: unknown;
    } | null;
  }) {
    return {
      id: order.id,
      orderNumber: order.orderNumber,
      status: order.status,
      total: decimalToNumber(order.total),
      createdAt: order.createdAt,
      customer: {
        id: order.user.id,
        name: order.user.name,
        phone: order.user.phone,
      },
      assignedDelivery: order.assignedDelivery
        ? {
            id: order.assignedDelivery.id,
            name: order.assignedDelivery.name,
            phone: order.assignedDelivery.phone,
          }
        : null,
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
    };
  }

  private async requireActiveDeliveryAssignee(assignedDeliveryId?: string) {
    const deliveryId = String(assignedDeliveryId || '').trim();
    if (!deliveryId) {
      throw new BadRequestException('يجب اختيار مندوب التوصيل قبل قبول الطلب.');
    }

    const selectedDelivery = await this.prisma.user.findFirst({
      where: {
        id: deliveryId,
        role: UserRole.DELIVERY,
        isActive: true,
      },
      select: {
        id: true,
        name: true,
        phone: true,
      },
    });

    if (!selectedDelivery) {
      throw new BadRequestException('المندوب المحدد غير موجود أو غير نشط.');
    }

    return selectedDelivery;
  }

  private async listActiveDeliveryUsersWithLoad() {
    const deliveryUsers = await this.prisma.user.findMany({
      where: {
        role: UserRole.DELIVERY,
        isActive: true,
      },
      select: {
        id: true,
        name: true,
        phone: true,
        createdAt: true,
      },
      orderBy: {
        createdAt: 'asc',
      },
    });

    if (!deliveryUsers.length) {
      return [];
    }

    const loadRows = await this.prisma.order.groupBy({
      by: ['assignedDeliveryId'],
      where: {
        assignedDeliveryId: {
          in: deliveryUsers.map((user) => user.id),
        },
        status: {
          in: [OrderStatus.PREPARING, OrderStatus.ON_THE_WAY],
        },
      },
      _count: {
        _all: true,
      },
    });

    const loadByDeliveryId = new Map<string, number>();
    loadRows.forEach((row) => {
      if (row.assignedDeliveryId) {
        loadByDeliveryId.set(row.assignedDeliveryId, row._count._all);
      }
    });

    return deliveryUsers
      .map((deliveryUser) => ({
        id: deliveryUser.id,
        name: deliveryUser.name,
        phone: deliveryUser.phone,
        createdAt: deliveryUser.createdAt,
        activeOrdersCount: loadByDeliveryId.get(deliveryUser.id) || 0,
      }))
      .sort((a, b) => {
        if (a.activeOrdersCount !== b.activeOrdersCount) {
          return a.activeOrdersCount - b.activeOrdersCount;
        }

        return a.createdAt.getTime() - b.createdAt.getTime();
      });
  }
}
