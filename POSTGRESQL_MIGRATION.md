# PostgreSQL — Qulay Ish

## 1. PostgreSQL

```bash
npm run db:up
npm run api:install
```

`api/.env` yarating (`api/.env.example` dan).

## 2. Migratsiya va seed

```bash
cd api && npx prisma migrate deploy
npm run db:seed
```

Import JSON fayllar `data/import/` papkasida bo'lishi kerak (ixtiyoriy).

## 3. Ishga tushirish

```bash
npm run api:dev
npm run dev
```

## Tekshiruv

```bash
curl http://localhost:4000/api/stats/counts
```
