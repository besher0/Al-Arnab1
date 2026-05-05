import { IsBoolean, IsInt, IsOptional, Max, Min } from 'class-validator';
import { Transform } from 'class-transformer';

export class ListNotificationsQueryDto {
  @IsOptional()
  @Transform(({ value }) => Number.parseInt(String(value ?? ''), 10))
  @IsInt()
  @Min(1)
  @Max(100)
  limit?: number;

  @IsOptional()
  @Transform(({ value }) => {
    if (typeof value === 'boolean') return value;
    const normalized = String(value ?? '').trim().toLowerCase();
    return normalized === 'true' || normalized === '1';
  })
  @IsBoolean()
  unreadOnly?: boolean;
}
