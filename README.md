# ishliayol.uz

Samarqand ish platformasi — **React (Vite) + NestJS + PostgreSQL**.  
Brauzer va Android APK **bir xil backend / bir xil baza** bilan ishlaydi.

## Tezkor start

```bash
git clone https://github.com/Kamol0303/qulay_ish.git
cd qulay_ish
git checkout main && git pull origin main

npm install
cd api && npm install && cd ..

cp .env.example .env
cp api/.env.example api/.env
# api/.env ichida SUPER_ADMIN_PASSWORD va JWT_SECRET ni to‘ldiring

npm run db:setup
npm run dev
```

- Sayt: http://localhost:3000  
- API: http://localhost:4000/api  
- Super Admin: http://localhost:3000/super-admin-login  

**To‘liq qo‘llanma (clone → env → DB → login → APK → xatolar):**  
👉 **[`SETUP.md`](./SETUP.md)**

## Hujjatlar

| Fayl | Mazmun |
|------|--------|
| [`SETUP.md`](./SETUP.md) | Clone va ishga tushirish (to‘liq) |
| [`MOBILE.md`](./MOBILE.md) | Android APK (Capacitor) |
| [`AUDIT.md`](./AUDIT.md) | Kod bazasi auditi |
| [`ARCHITECTURE_DECISION.md`](./ARCHITECTURE_DECISION.md) | Mobil arxitektura qarori |
| [`nginx-config.conf`](./nginx-config.conf) | Production nginx (ishliayol.uz) |

## Asosiy buyruqlar

```bash
npm run dev          # Postgres + API + frontend
npm run db:setup     # PostgreSQL + migratsiya
npm run api:dev      # faqat API
npm run dev:web      # faqat frontend
npm run db:down      # Postgres to‘xtatish

./scripts/build-apk.sh debug    # Android debug APK
./scripts/build-apk.sh release  # imzolangan release APK
```

## Super Admin (lokal)

`api/.env` dagi qiymatlar bilan:

- URL: `/super-admin-login`
- Email: `SUPER_ADMIN_EMAIL`
- Telefon: `SUPER_ADMIN_PHONE`
- Parol: `SUPER_ADMIN_PASSWORD`
