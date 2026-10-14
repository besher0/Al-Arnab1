import { mkdir, writeFile } from 'node:fs/promises'
import { join } from 'node:path'

const SITE = (process.env.SEO_SITE_URL || 'https://al-arnab1.onrender.com').replace(/\/$/, '')
const API = (process.env.SEO_API_URL || 'https://al-arnab-backend.onrender.com').replace(/\/$/, '')
const DIST = new URL('../dist/', import.meta.url).pathname
const esc = (s) => String(s ?? '').replace(/[&<>"']/g, (c) => ({'&':'&amp;','<':'&lt;','>':'&gt;','"':'&quot;',"'":'&#39;'}[c]))
const safeJson = (o) => JSON.stringify(o).replace(/</g, '\\u003c')
const absoluteImage = (s) => {
  try { const u = new URL(s, SITE); return ['https:', 'http:'].includes(u.protocol) ? u.href : '' } catch { return '' }
}
const slug = (s) => encodeURIComponent(String(s))
const link = (path) => SITE + path
const xml = (s) => esc(s)
const page = ({ title, description, url, image, body, data }) => `<!doctype html>
<html lang="ar" dir="rtl"><head><meta charset="utf-8"><meta name="viewport" content="width=device-width,initial-scale=1">
<title>${esc(title)} | الأرنب</title><meta name="description" content="${esc(description)}">
<link rel="canonical" href="${esc(url)}"><meta name="robots" content="index,follow,max-image-preview:large">
<meta property="og:type" content="website"><meta property="og:site_name" content="الأرنب">
<meta property="og:title" content="${esc(title)}"><meta property="og:description" content="${esc(description)}">
<meta property="og:url" content="${esc(url)}">
${image ? `<meta property="og:image" content="${esc(image)}">` : ''}
${data ? `<script type="application/ld+json">${safeJson(data)}</script>` : ''}
<style>body{font-family:system-ui,sans-serif;max-width:900px;margin:auto;padding:24px;line-height:1.8}img{max-width:100%;height:auto}a{color:#165a77}li{margin:8px 0}</style>
</head><body><header><a href="/">متجر الأرنب</a></header><main>${body}</main></body></html>`
const save = async (path, content) => {
  const target = join(DIST, path)
  await mkdir(join(target, '..'), { recursive: true })
  await writeFile(target, content, 'utf8')
}
async function getCatalog() {
  const controller = new AbortController()
  const timeout = setTimeout(() => controller.abort(), 45000)
  try {
    const response = await fetch(API + '/api/catalog/bootstrap', { signal: controller.signal })
    if (!response.ok) throw new Error('Catalog HTTP ' + response.status)
    const json = await response.json()
    if (!Array.isArray(json?.products) || !Array.isArray(json?.categories)) throw new Error('Invalid catalog response')
    return json
  } finally { clearTimeout(timeout) }
}
async function main() {
  const { products, categories, store } = await getCatalog()
  const activeCategories = categories.filter((c) => c?.id && c?.slug)
  const categoryIds = new Set(activeCategories.map((c) => c.id))
  const activeProducts = products.filter((p) => p?.id && p?.isActive !== false && categoryIds.has(p.categoryId))
  const paths = ['/']
  for (const c of activeCategories) {
    const path = '/categories/' + slug(c.slug) + '/'
    const items = activeProducts.filter((p) => p.categoryId === c.id)
    const body = `<h1>${esc(c.nameAr)}</h1><p>${esc(c.description || 'تصفح منتجات قسم ' + c.nameAr)}</p><ul>${items.map((p) => `<li><a href="/products/${slug(p.id)}/">${esc(p.name)}</a></li>`).join('')}</ul>`
    await save('categories/' + slug(c.slug) + '/index.html', page({
      title: c.nameAr, description: c.description || 'تصفح قسم ' + c.nameAr + ' في متجر الأرنب',
      url: link(path), image: absoluteImage(c.imageUrl), body,
    }))
    paths.push(path)
  }
  for (const p of activeProducts) {
    const path = '/products/' + slug(p.id) + '/'
    const image = absoluteImage(p.imageUrl)
    const description = p.description || 'تعرّف على ' + p.name + ' من متجر الأرنب'
    const price = Number(p.price)
    const currency = store?.currency || 'SYP'
    const offer = Number.isFinite(price) && price >= 0 && /^[A-Z]{3}$/.test(currency)
      ? { offers: { '@type': 'Offer', price, priceCurrency: currency, url: link(path) } } : {}
    const data = { '@context': 'https://schema.org', '@type': 'Product', name: p.name, description, url: link(path), ...(image ? { image: [image] } : {}), ...offer }
    const body = `<h1>${esc(p.name)}</h1>${image ? `<img src="${esc(image)}" alt="${esc(p.name)}" width="420">` : ''}<p>${esc(description)}</p>${Number.isFinite(price) ? `<p>السعر: ${esc(price)} ${esc(currency)}</p>` : ''}<p><a href="/#/product/${slug(p.id)}">فتح المنتج والطلب من المتجر</a></p>`
    await save('products/' + slug(p.id) + '/index.html', page({ title: p.name, description, url: link(path), image, body, data }))
    paths.push(path)
  }
  await save('sitemap.xml', '<?xml version="1.0" encoding="UTF-8"?>\n<urlset xmlns="http://www.sitemaps.org/schemas/sitemap/0.9">\n' +
    paths.map((p) => '  <url><loc>' + xml(link(p)) + '</loc></url>').join('\n') + '\n</urlset>\n')
  await save('robots.txt', 'User-agent: *\nAllow: /\nDisallow: /admin/\nDisallow: /delivery/\nSitemap: ' + link('/sitemap.xml') + '\n')
  console.log('SEO: generated ' + activeProducts.length + ' products and ' + activeCategories.length + ' categories')
}
main().catch((error) => { console.error('SEO generation failed:', error); process.exitCode = 1 })
