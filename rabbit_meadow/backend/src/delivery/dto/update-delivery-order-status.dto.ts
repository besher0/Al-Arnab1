import { OrderStatus } from '@prisma/client';
import { IsEnum, IsIn, IsOptional, IsString, MaxLength } from 'class-validator';

export class UpdateDeliveryOrderStatusDto {
  @IsEnum(OrderStatus)
  @IsIn([OrderStatus.ON_THE_WAY, OrderStatus.DELIVERED])
  status!: OrderStatus;

  @IsOptional()
  @IsString()
  @MaxLength(400)
  note?: string;
}
