# Al-Arnab Frontend (React + Vite)

## Run
1. Install dependencies:
```bash
npm install
```
2. Optional env override:
```bash
cp .env.example .env
```
3. Start dev server:
```bash
npm run dev
```

Default backend URL used by frontend: `http://localhost:3000/api`

## Routes
- Customer welcome: `/#/welcome`
- Customer home: `/#/home`
- Admin dashboard: `/#/admin/dashboard`

## Notes
- Frontend uses iframe-based stitched pages.
- App state (auth/cart/catalog) now comes from backend API only.
