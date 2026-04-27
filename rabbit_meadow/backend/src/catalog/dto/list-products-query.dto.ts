import { IsBooleanString, IsOptional, IsString } from 'class-validator';

export class ListProductsQueryDto {
  @IsOptional()
  @IsString()
  categoryId?: string;

  @IsOptional()
  @IsBooleanString()
  activeOnly?: string;
}
