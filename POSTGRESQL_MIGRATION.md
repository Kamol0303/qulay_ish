# PostgreSQL migratsiya — ishga tushirish

## 1. PostgreSQL (Docker)

```bash
npm run db:up
```

## 2. API o'rnatish va migratsiya

```bash
npm run api:install
cd api && cp .env.example .env
cd api && npx prisma migrate deploy
cd api && npm run prisma:seed
```

## 3. Firestore dan ma'lumot eksport

Cursor/GitHub Secret: `FIREBASE_SERVICE_ACCOUNT` (to'liq JSON).

```bash
# .env da FIREBASE_PROJECT_ID va FIRESTORE_DATABASE_ID bo'lishi kerak
npm run export:firestore
npm run db:seed
```

## 4. API ishga tushirish

```bash
npm run api:dev
```

API: http://localhost:4000/api

## 5. Frontend

`.env` ga qo'shing:

```env
VITE_API_URL=http://localhost:4000/api
```

```bash
npm run dev
```

## Tekshiruv

```bash
curl http://localhost:4000/api/stats/counts
```

## Eslatma

- Eski Firebase ma'lumotlari `data/firestore-export/` da saqlanadi (gitignore).
- `main` branch o'zgarmaydi — ish `CURSOR/postgresql-phase1-02cb` da.
- Ba'zi sahifalar hali to'g'ridan Firestore chaqiruvlarini ishlatishi mumkin — servislar orqali API ga o'tkazish davom etadi.
