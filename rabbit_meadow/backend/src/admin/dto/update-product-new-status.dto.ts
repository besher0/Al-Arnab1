import { Type } from 'class-transformer';
import { IsBoolean } from 'class-validator';

export class UpdateProductNewStatusDto {
  @Type(() => Boolean)
  @IsBoolean()
  isNew!: boolean;
}
