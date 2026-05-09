import { Transform, Type } from 'class-transformer';
import { IsNumber, IsObject, IsOptional, IsString, Length, Max, Min } from 'class-validator';

export class CheckoutCartDto {
  @IsOptional()
  @Transform(({ value }) => {
    const normalized = String(value ?? '').trim();
    return normalized || undefined;
  })
  @IsString()
  @Length(6, 20)
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
