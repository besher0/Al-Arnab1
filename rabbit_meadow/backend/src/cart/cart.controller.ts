import { Body, Controller, Delete, Get, Param, Patch, Post, Req, UseGuards } from '@nestjs/common';
import { JwtAuthGuard } from '../common/guards/jwt-auth.guard';
import type { RequestWithUser } from '../common/types/request-with-user';
import { AddCartItemDto } from './dto/add-cart-item.dto';
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
}
