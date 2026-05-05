import { IsOptional, IsString, Length } from 'class-validator';

export class RegisterDeviceTokenDto {
  @IsString()
  @Length(20, 3000)
  token!: string;

  @IsOptional()
  @IsString()
  @Length(2, 32)
  platform?: string;

  @IsOptional()
  @IsString()
  @Length(1, 120)
  deviceName?: string;
}
