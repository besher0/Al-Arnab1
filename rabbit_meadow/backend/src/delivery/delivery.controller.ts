import { Body, Controller, Get, Param, Patch, Req, UseGuards } from '@nestjs/common';
import { UserRole } from '@prisma/client';
import { Roles } from '../common/decorators/roles.decorator';
import { JwtAuthGuard } from '../common/guards/jwt-auth.guard';
import { RolesGuard } from '../common/guards/roles.guard';
import type { RequestWithUser } from '../common/types/request-with-user';
import { DeliveryService } from './delivery.service';
import { UpdateDeliveryOrderStatusDto } from './dto/update-delivery-order-status.dto';

@UseGuards(JwtAuthGuard, RolesGuard)
@Roles(UserRole.DELIVERY)
@Controller('delivery')
export class DeliveryController {
  constructor(private readonly deliveryService: DeliveryService) {}

  @Get('orders')
  listMyOrders(@Req() req: RequestWithUser) {
    return this.deliveryService.listMyOrders(req.user.sub);
  }

  @Get('orders/:id')
  getMyOrder(@Req() req: RequestWithUser, @Param('id') id: string) {
    return this.deliveryService.getMyOrder(id, req.user.sub);
  }

  @Patch('orders/:id/status')
  updateOrderStatus(
    @Req() req: RequestWithUser,
    @Param('id') id: string,
    @Body() payload: UpdateDeliveryOrderStatusDto,
  ) {
    return this.deliveryService.updateMyOrderStatus(id, req.user.sub, payload);
  }
}
