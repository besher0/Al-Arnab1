import { Type } from 'class-transformer';
import { IsNumber, IsString, Min } from 'class-validator';

export class AddCartItemDto {
  @IsString()
  productId!: string;

  @Type(() => Number)
  @IsNumber()
  @Min(0.01)
  qty!: number;
}
