import { Controller, Get, Param, Res } from '@nestjs/common';
import type { Response } from 'express';
import { PrismaService } from '../prisma/prisma.service';

const SITE_URL = (process.env.SEO_PUBLIC_ORIGIN || 'https://al-arnab-backend.onrender.com').replace(/\/$/, '');
const STOREFRONT_URL = (process.env.PUBLIC_SITE_URL || 'https://al-arnab1.onrender.com').replace(/\/$/, '');
const escapeHtml = (value: unknown) => String(value ?? '').replace(/[&<>"']/g, (char) => ({
  '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;',
})[char] || char);
const absoluteImage = (value: string | null) => {
  if (!value) return '';
  try {
    const url = new URL(value, SITE_URL);
    return ['https:', 'http:'].includes(url.protocol) ? url.toString() : '';
  } catch { return ''; }
};

@Controller('seo')
export class CatalogSeoController {
  constructor(private readonly prisma: PrismaService) {}

  @Get('sitemap.xml')
  async sitemap(@Res() res: Response) {
    const [products, categories] = await Promise.all([
      this.prisma.product.findMany({ where: { isActive: true, category: { isActive: true } }, select: { id: true, updatedAt: true } }),
      this.prisma.category.findMany({ where: { isActive: true }, select: { slug: true, updatedAt: true } }),
    ]);
    const entry = (path: string, date?: Date) =>
      '<url><loc>' + escapeHtml(SITE_URL + path) + '</loc>' +
      (date ? '<lastmod>' + date.toISOString() + '</lastmod>' : '') + '</url>';
    const xml = '<?xml version="1.0" encoding="UTF-8"?>' +
      '<urlset xmlns="http://www.sitemaps.org/schemas/sitemap/0.9">' +
      '' +
      categories.map((c) => entry('/api/seo/category/' + encodeURIComponent(c.slug), c.updatedAt)).join('') +
      products.map((p) => entry('/api/seo/product/' + encodeURIComponent(p.id), p.updatedAt)).join('') +
      '</urlset>';
    res.setHeader('Content-Type', 'application/xml; charset=utf-8');
    res.setHeader('Cache-Control', 'public, max-age=300');
    return res.send(xml);
  }

  @Get('product/:id')
  async product(@Param('id') id: string, @Res() res: Response) {
    const product = await this.prisma.product.findFirst({
      where: { id, isActive: true, category: { isActive: true } },
      include: { category: true },
    });
    if (!product) return res.status(404).send('المنتج غير متوفر');
    const canonical = SITE_URL + '/api/seo/product/' + encodeURIComponent(product.id);
    const image = absoluteImage(product.imageUrl);
    const description = product.description || 'تعرّف على ' + product.nameAr + ' من متجر الأرنب.';
    const structured = JSON.stringify({
      '@context': 'https://schema.org', '@type': 'Product', name: product.nameAr,
      description, ...(image ? { image: [image] } : {}),
      sku: product.sku || product.id, url: canonical
    }).replace(/</g, '\\u003c');
    return this.page(res, product.nameAr, description, canonical, image, structured,
      '<h1>' + escapeHtml(product.nameAr) + '</h1><p>' + escapeHtml(description) + '</p>' +
      (image ? '<img width="320" loading="lazy" alt="' + escapeHtml(product.nameAr) + '" src="' + escapeHtml(image) + '">' : '') +
      '<p><a href="' + escapeHtml(STOREFRONT_URL + '/#/product/' + encodeURIComponent(product.id)) + '">عرض المنتج في المتجر</a></p>');
  }

  @Get('category/:slug')
  async category(@Param('slug') slug: string, @Res() res: Response) {
    const category = await this.prisma.category.findFirst({ where: { slug, isActive: true } });
    if (!category) return res.status(404).send('القسم غير متوفر');
    const products = await this.prisma.product.findMany({
      where: { categoryId: category.id, isActive: true }, select: { id: true, nameAr: true },
      orderBy: { nameAr: 'asc' },
    });
    const canonical = SITE_URL + '/api/seo/category/' + encodeURIComponent(category.slug);
    const description = category.description || 'تصفح منتجات قسم ' + category.nameAr + ' في متجر الأرنب.';
    const links = products.map((p) => '<li><a href="' + escapeHtml(SITE_URL + '/api/seo/product/' + encodeURIComponent(p.id)) + '">' + escapeHtml(p.nameAr) + '</a></li>').join('');
    return this.page(res, category.nameAr, description, canonical, absoluteImage(category.imageUrl), '',
      '<h1>' + escapeHtml(category.nameAr) + '</h1><p>' + escapeHtml(description) + '</p><ul>' + links + '</ul>');
  }

  private page(res: Response, title: string, description: string, canonical: string, image: string, jsonLd: string, body: string) {
    res.setHeader('Content-Type', 'text/html; charset=utf-8');
    res.setHeader('Cache-Control', 'public, max-age=300');
    return res.send('<!doctype html><html lang="ar" dir="rtl"><head><meta charset="utf-8">' +
      '<meta name="viewport" content="width=device-width,initial-scale=1">' +
      '<title>' + escapeHtml(title) + ' | الأرنب</title>' +
      '<meta name="description" content="' + escapeHtml(description) + '">' +
      '<link rel="canonical" href="' + escapeHtml(canonical) + '">' +
      '<meta property="og:type" content="website"><meta property="og:title" content="' + escapeHtml(title) + '">' +
      '<meta property="og:description" content="' + escapeHtml(description) + '">' +
      (image ? '<meta property="og:image" content="' + escapeHtml(image) + '">' : '') +
      (jsonLd ? '<script type="application/ld+json">' + jsonLd + '</script>' : '') +
      '</head><body><main>' + body + '</main><footer><a href="' + escapeHtml(SITE_URL) + '">متجر الأرنب</a></footer></body></html>');
  }
}
