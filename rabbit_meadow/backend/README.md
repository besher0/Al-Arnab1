# Al-Arnab Backend (NestJS + Prisma + PostgreSQL)

Backend API for `react-ui`.

## Stack
- NestJS 11
- Prisma 6
- PostgreSQL
- JWT auth

## Quick Start
1. Install dependencies:
```bash
npm install
```
2. Configure environment:
```bash
cp .env.example .env
```
3. Run migrations:
```bash
npm run prisma:deploy
```
4. Generate Prisma client (if needed):
```bash
npm run prisma:generate
```
5. Seed initial data:
```bash
npm run prisma:seed
```
6. Run server:
```bash
npm run start:dev
```

Server URL: `http://localhost:3000/api`

## Seeded Accounts
- Admin: `0500000000`

## Cleanup Demo Data
- Delete seeded/demo catalog and transactional data while keeping admin users:
```bash
npm run prisma:cleanup-demo
```

## Main Endpoints
### Auth
- `POST /api/auth/register`
- `POST /api/auth/login`
- `POST /api/auth/guest`
- `GET /api/auth/session`

### Public Catalog
- `GET /api/catalog/bootstrap`
- `GET /api/catalog/categories`
- `GET /api/catalog/products`

### Cart (JWT required)
- `GET /api/cart`
- `POST /api/cart/items`
- `PATCH /api/cart/items/:productId`
- `DELETE /api/cart/clear`

### Admin (JWT + ADMIN role)
- `GET /api/admin/dashboard`
- `GET /api/admin/orders/current`
- `GET /api/admin/orders/completed`
- `GET /api/admin/orders/:id`
- `PATCH /api/admin/orders/:id/status`
- `GET /api/admin/settings/store`
- `PATCH /api/admin/settings/store`
- `GET /api/admin/reports/sales`
- `GET /api/admin/categories`
- `POST /api/admin/categories`
- `GET /api/admin/products`
- `POST /api/admin/products`
- `POST /api/admin/discounts`

## Notes
- Global API prefix is `/api`.
- CORS allows frontend from `http://localhost:5173`.
- Prisma schema is in `prisma/schema.prisma`.
