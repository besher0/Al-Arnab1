import { IsOptional, IsString, Length } from 'class-validator';

export class GuestDto {
  @IsOptional()
  @IsString()
  @Length(2, 100)
  name?: string;
}
