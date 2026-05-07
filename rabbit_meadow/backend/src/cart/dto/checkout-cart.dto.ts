import { Type } from 'class-transformer';
import { IsNumber, IsObject, IsOptional, Max, Min } from 'class-validator';

export class CheckoutCartDto {
  @IsOptional()
  alternatePhone?: string;

  @Type(() => Number)
  @IsNumber()
  @Min(-90)
  @Max(90)
  latitude!: number;

  @Type(() => Number)
  @IsNumber()
  @Min(-180)
  @Max(180)
  longitude!: number;

  @IsOptional()
  @IsObject()
  itemNotes?: Record<string, string>;
}
