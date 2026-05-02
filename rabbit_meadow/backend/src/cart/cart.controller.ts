import { Body, Controller, Delete, Get, Param, Patch, Post, Req, UseGuards } from '@nestjs/common';
import { JwtAuthGuard } from '../common/guards/jwt-auth.guard';
import type { RequestWithUser } from '../common/types/request-with-user';
import { AddCartItemDto } from './dto/add-cart-item.dto';
import { CheckoutCartDto } from './dto/checkout-cart.dto';
import { UpdateCartItemDto } from './dto/update-cart-item.dto';
import { CartService } from './cart.service';

@UseGuards(JwtAuthGuard)
@Controller('cart')
export class CartController {
  constructor(private readonly cartService: CartService) {}

  @Get()
  getCart(@Req() req: RequestWithUser) {
    return this.cartService.getCart(req.user.sub);
  }

  @Post('items')
  addItem(@Req() req: RequestWithUser, @Body() payload: AddCartItemDto) {
    return this.cartService.addItem(req.user.sub, payload);
  }

  @Patch('items/:productId')
  setItemQty(
    @Req() req: RequestWithUser,
    @Param('productId') productId: string,
    @Body() payload: UpdateCartItemDto,
  ) {
    return this.cartService.setItemQty(req.user.sub, productId, payload);
  }

  @Delete('clear')
  clear(@Req() req: RequestWithUser) {
    return this.cartService.clearCart(req.user.sub);
  }

  @Get('orders')
  listOrders(@Req() req: RequestWithUser) {
    return this.cartService.listUserOrders(req.user.sub);
  }

  @Post('checkout')
  checkout(@Req() req: RequestWithUser, @Body() payload: CheckoutCartDto) {
    return this.cartService.checkout(req.user.sub, payload);
  }

  @Post('orders/:orderId/confirm')
  confirmOrder(@Req() req: RequestWithUser, @Param('orderId') orderId: string) {
    return this.cartService.confirmOrder(req.user.sub, orderId);
  }

  @Post('orders/:orderId/return')
  returnOrder(@Req() req: RequestWithUser, @Param('orderId') orderId: string) {
    return this.cartService.returnOrder(req.user.sub, orderId);
  }
}
