import { Controller, Get, Query } from '@nestjs/common';
import { CatalogService } from './catalog.service';
import { ListProductsQueryDto } from './dto/list-products-query.dto';

@Controller('catalog')
export class CatalogController {
  constructor(private readonly catalogService: CatalogService) {}

  @Get('bootstrap')
  bootstrap() {
    return this.catalogService.bootstrapData();
  }

  @Get('categories')
  categories() {
    return this.catalogService.listCategories();
  }

  @Get('products')
  products(@Query() query: ListProductsQueryDto) {
    return this.catalogService.listProducts(query);
  }
}
