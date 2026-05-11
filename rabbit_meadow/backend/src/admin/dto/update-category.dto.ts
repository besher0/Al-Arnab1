import { Type } from 'class-transformer';
import { IsBoolean, IsInt, IsOptional, IsString, Length } from 'class-validator';

export class UpdateCategoryDto {
  @IsOptional()
  @IsString()
  @Length(2, 80)
  slug?: string;

  @IsOptional()
  @IsString()
  @Length(2, 120)
  nameAr?: string;

  @IsOptional()
  @IsString()
  @Length(2, 120)
  nameEn?: string;

  @IsOptional()
  @IsString()
  imageUrl?: string;

  @IsOptional()
  @IsString()
  description?: string;

  @IsOptional()
  @Type(() => Number)
  @IsInt()
  sortOrder?: number;

  @IsOptional()
  @Type(() => Boolean)
  @IsBoolean()
  isActive?: boolean;
}
