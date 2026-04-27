import { Type } from 'class-transformer';
import {
  ArrayMinSize,
  IsArray,
  IsBoolean,
  IsDateString,
  IsEnum,
  IsNumber,
  IsOptional,
  IsString,
  Length,
  Min,
} from 'class-validator';
import { DiscountTargetType, DiscountType } from '@prisma/client';

export class CreateDiscountDto {
  @IsString()
  @Length(2, 120)
  title!: string;

  @IsOptional()
  @IsString()
  description?: string;

  @IsOptional()
  @IsString()
  bannerUrl?: string;

  @IsEnum(DiscountType)
  type!: DiscountType;

  @Type(() => Number)
  @IsNumber()
  @Min(0)
  value!: number;

  @IsDateString()
  startAt!: string;

  @IsDateString()
  endAt!: string;

  @IsOptional()
  @Type(() => Boolean)
  @IsBoolean()
  isActive?: boolean;

  @IsEnum(DiscountTargetType)
  targetType!: DiscountTargetType;

  @IsArray()
  @ArrayMinSize(1)
  @IsString({ each: true })
  targetIds!: string[];
}
