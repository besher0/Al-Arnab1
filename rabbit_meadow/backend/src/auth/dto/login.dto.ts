import { IsOptional, IsString, Length } from 'class-validator';

export class LoginDto {
  @IsString()
  @Length(6, 20)
  phone!: string;

  @IsOptional()
  @IsString()
  @Length(3, 100)
  name?: string;
}
