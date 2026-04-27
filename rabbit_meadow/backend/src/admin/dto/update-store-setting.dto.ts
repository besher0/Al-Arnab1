import { Type } from 'class-transformer';
import { IsBoolean, IsOptional, IsNumber, IsString, Min } from 'class-validator';

export class UpdateStoreSettingDto {
  @IsOptional()
  @Type(() => Boolean)
  @IsBoolean()
  isOpen?: boolean;

  @IsOptional()
  @IsString()
  currency?: string;

  @IsOptional()
  @Type(() => Number)
  @IsNumber()
  @Min(0)
  usdSarRate?: number;
}
