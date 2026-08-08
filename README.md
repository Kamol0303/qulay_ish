# ishliayol.uz

Samarqand shahar hokimligi ish platformasi (React + NestJS + PostgreSQL).

## Talablar

- Node.js 20+
- npm
- Docker (PostgreSQL uchun)

## Birinchi marta sozlash

```bash
cd ~/Desktop/qulay_ish

git checkout main
git pull origin main

npm install
cd api && npm install && cd ..
```

### Environment fayllar

Ildizda `.env` (frontend):

```bash
cp .env.example .env
```

API uchun `api/.env`:

```bash
cp api/.env.example api/.env
```

`api/.env` ichida kamida quyidagilarni to‘ldiring:

```env
DATABASE_URL=postgresql://qulay_ish:qulay_ish_dev@localhost:5432/qulay_ish
JWT_SECRET=change-me-in-production
API_PORT=4000
CORS_ORIGIN=http://localhost:3000,http://127.0.0.1:3000

SUPER_ADMIN_EMAIL=superadmin@ishliayol.uz
SUPER_ADMIN_PASSWORD=your_password
SUPER_ADMIN_PHONE=+998900707081

# SMS (ixtiyoriy). Bo'sh bo'lsa OTP konsolda chiqadi
DEVSMS_TOKEN=
```

Frontend `.env` da:

```env
VITE_API_URL=/api
VITE_SUPER_ADMIN_EMAIL=superadmin@ishliayol.uz
VITE_SUPER_ADMIN_PASSWORD=your_password
VITE_SUPER_ADMIN_PHONE=+998900707081
```

## Ishga tushirish

Bitta buyruq (Postgres + API + frontend):

```bash
cd ~/Desktop/qulay_ish
npm run dev
```

Brauzer: [http://localhost:3000](http://localhost:3000)  
API: [http://localhost:4000/api](http://localhost:4000/api)

### Alohida buyruqlar (ixtiyoriy)

```bash
# Faqat PostgreSQL
npm run db:up

# Faqat API
npm run api:dev

# Faqat frontend
npm run dev:web
```

## Super Admin

Kirish sahifasi: `/super-admin-login`

Login va parol `api/.env` dagi `SUPER_ADMIN_EMAIL` / `SUPER_ADMIN_PHONE` va `SUPER_ADMIN_PASSWORD` qiymatlari bilan bir xil bo‘lishi kerak.

## Oddiy foydalanuvchi

1. `/auth?mode=register` — telefon + parol (min 8) + OTP
2. `/auth?mode=login` — telefon + OTP

## Android APK (Capacitor)

Sayt va APK **bir xil backend** (`https://ishliayol.uz/api` → NestJS → PostgreSQL) bilan ishlaydi.

To‘liq yo‘riqnoma: [`MOBILE.md`](./MOBILE.md) · Audit: [`AUDIT.md`](./AUDIT.md) · Qaror: [`ARCHITECTURE_DECISION.md`](./ARCHITECTURE_DECISION.md)

```bash
# Debug
./scripts/build-apk.sh debug

# Imzolangan release (local keystore; Play Store uchun alohida saqlang)
./scripts/build-apk.sh release
```

APK: `android/app/build/outputs/apk/...` yoki `/opt/cursor/artifacts/ishliayol-*-latest.apk`

## To‘xtatish

Terminalda `Ctrl + C`.

Postgres konteynerini to‘xtatish:

```bash
npm run db:down
```

## Muammo bo‘lsa

```bash
# Toza pull
git checkout main
git pull origin main

# Port band bo‘lsa
# 3000 yoki 4000 band — eski `npm run dev` ni to‘xtating

# DB migratsiya
cd api && npx prisma migrate deploy && cd ..
```
