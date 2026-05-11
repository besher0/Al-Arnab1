import { IsEnum, IsOptional, IsString, Length } from 'class-validator';

export enum AdminNotificationAudience {
  CUSTOMERS = 'CUSTOMERS',
  ADMINS = 'ADMINS',
  ALL = 'ALL',
}

export class CreateAdminNotificationDto {
  @IsString()
  @Length(2, 120)
  title!: string;

  @IsString()
  @Length(2, 500)
  body!: string;

  @IsOptional()
  @IsEnum(AdminNotificationAudience)
  audience?: AdminNotificationAudience;

  @IsOptional()
  @IsString()
  @Length(6, 24)
  targetPhone?: string;
}
