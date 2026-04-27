import { IsString, Length } from 'class-validator';

export class RegisterDto {
  @IsString()
  @Length(2, 100)
  name!: string;

  @IsString()
  @Length(6, 20)
  phone!: string;
}
