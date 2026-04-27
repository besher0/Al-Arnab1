import { Type } from 'class-transformer';
import { IsNumber, Min } from 'class-validator';

export class UpdateCartItemDto {
  @Type(() => Number)
  @IsNumber()
  @Min(0)
  qty!: number;
}
