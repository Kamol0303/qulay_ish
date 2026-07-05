# Qulay Ish — PostgreSQL + NestJS

O'zbekiston uchun ish topish platformasi. Barcha ma'lumotlar PostgreSQL va REST API orqali ishlaydi.

## Arxitektura

```
React (Vite)  →  NestJS API (:4000)  →  PostgreSQL (:5432)
```

## Tez ishga tushirish

```bash
# 1. PostgreSQL
npm run db:up

# 2. API
npm run api:install
cp api/.env.example api/.env   # parollarni to'ldiring

# 3. Ma'lumotlar (agar import JSON mavjud bo'lsa)
npm run db:seed

# 4. Ishga tushirish
npm run api:dev    # terminal 1
npm run dev        # terminal 2
```

- Frontend: http://localhost:3000
- API: http://localhost:4000/api

## `.env`

**Frontend (`.env`):**
```env
VITE_API_URL=/api
VITE_SUPER_ADMIN_PHONE=+998...
VITE_SUPER_ADMIN_PASSWORD=...
VITE_SUPER_ADMIN_EMAIL=superadmin@qulay-ish.local
```

**API (`api/.env`):** `api/.env.example` dan nusxa oling.

### OTP (Telegram Gateway)

Ro'yxatdan o'tish va kirish OTP kodlari **Telegram Gateway API** orqali yuboriladi.

1. [gateway.telegram.org](https://gateway.telegram.org) dan `TELEGRAM_GATEWAY_TOKEN` oling
2. `api/.env` ga qo'shing:
   ```env
   TELEGRAM_GATEWAY_TOKEN=your_token
   TELEGRAM_GATEWAY_BASE_URL=https://gatewayapi.telegram.org
   ```
3. Foydalanuvchi telefon raqami Telegram hisobiga bog'langan bo'lishi kerak (`+998...`)

Batafsil: [POSTGRESQL_MIGRATION.md](./POSTGRESQL_MIGRATION.md)
