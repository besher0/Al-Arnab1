import { Module } from '@nestjs/common';
import { CatalogController } from './catalog.controller';
import { CatalogSeoController } from './catalog-seo.controller';
import { CatalogService } from './catalog.service';

@Module({
  controllers: [CatalogController, CatalogSeoController],
  providers: [CatalogService],
  exports: [CatalogService],
})
export class CatalogModule {}
