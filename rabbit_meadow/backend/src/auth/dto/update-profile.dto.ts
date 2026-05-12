import { IsOptional, IsString, Length, Matches } from 'class-validator';

export class UpdateProfileDto {
  @IsOptional()
  @IsString()
  @Length(2, 80)
  name?: string;

  @IsOptional()
  @IsString()
  @Length(8, 24)
  @Matches(/^[0-9+\-()\s]+$/, { message: 'صيغة رقم الهاتف غير صحيحة.' })
  phone?: string;
}
