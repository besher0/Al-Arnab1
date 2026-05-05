import {
  Body,
  Controller,
  Get,
  Param,
  Patch,
  Post,
  Query,
  Req,
  UseGuards,
} from '@nestjs/common';
import { UserRole } from '@prisma/client';
import { Roles } from '../common/decorators/roles.decorator';
import { JwtAuthGuard } from '../common/guards/jwt-auth.guard';
import { RolesGuard } from '../common/guards/roles.guard';
import type { RequestWithUser } from '../common/types/request-with-user';
import { AdminService } from './admin.service';
import { CreateCategoryDto } from './dto/create-category.dto';
import { CreateDiscountDto } from './dto/create-discount.dto';
import { CreateProductDto } from './dto/create-product.dto';
import { SalesReportQueryDto } from './dto/sales-report-query.dto';
import { UpdateOrderStatusDto } from './dto/update-order-status.dto';
import { UpdateProductNewStatusDto } from './dto/update-product-new-status.dto';
import { UpdateStoreSettingDto } from './dto/update-store-setting.dto';
import { CreateAdminNotificationDto } from '../notifications/dto/create-admin-notification.dto';

@UseGuards(JwtAuthGuard, RolesGuard)
@Roles(UserRole.ADMIN)
@Controller('admin')
export class AdminController {
  constructor(private readonly adminService: AdminService) {}

  @Get('dashboard')
  dashboard() {
    return this.adminService.getDashboard();
  }

  @Get('orders/current')
  currentOrders() {
    return this.adminService.listCurrentOrders();
  }

  @Get('orders/completed')
  completedOrders() {
    return this.adminService.listCompletedOrders();
  }

  @Get('orders/:id')
  orderDetail(@Param('id') id: string) {
    return this.adminService.getOrderDetail(id);
  }

  @Patch('orders/:id/status')
  updateOrderStatus(
    @Req() req: RequestWithUser,
    @Param('id') id: string,
    @Body() payload: UpdateOrderStatusDto,
  ) {
    return this.adminService.updateOrderStatus(id, payload, req.user.sub);
  }

  @Get('categories')
  categories() {
    return this.adminService.listCategories();
  }

  @Post('categories')
  createCategory(@Body() payload: CreateCategoryDto) {
    return this.adminService.createCategory(payload);
  }

  @Get('uploads/cloudinary-signature')
  cloudinaryUploadSignature() {
    return this.adminService.getCloudinaryUploadSignature();
  }

  @Get('products')
  products() {
    return this.adminService.listProducts();
  }

  @Post('products')
  createProduct(@Req() req: RequestWithUser, @Body() payload: CreateProductDto) {
    return this.adminService.createProduct(payload, req.user.sub);
  }

  @Patch('products/:id/new')
  updateProductNewStatus(
    @Param('id') id: string,
    @Body() payload: UpdateProductNewStatusDto,
  ) {
    return this.adminService.updateProductNewStatus(id, payload.isNew);
  }

  @Post('discounts')
  createDiscount(@Req() req: RequestWithUser, @Body() payload: CreateDiscountDto) {
    return this.adminService.createDiscount(payload, req.user.sub);
  }

  @Post('notifications')
  createNotification(@Req() req: RequestWithUser, @Body() payload: CreateAdminNotificationDto) {
    return this.adminService.createAdminNotification(payload, req.user.sub);
  }

  @Get('settings/store')
  getStoreSettings() {
    return this.adminService.getStoreSettings();
  }

  @Patch('settings/store')
  updateStoreSettings(@Req() req: RequestWithUser, @Body() payload: UpdateStoreSettingDto) {
    return this.adminService.updateStoreSettings(payload, req.user.sub);
  }

  @Get('reports/sales')
  salesReport(@Query() query: SalesReportQueryDto) {
    return this.adminService.salesReport(query);
  }
}
