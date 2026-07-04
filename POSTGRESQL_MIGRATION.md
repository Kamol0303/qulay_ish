# PostgreSQL migratsiya — to'liq qo'llanma

Firebase endi ishlatilmaydi. Barcha ma'lumotlar PostgreSQL + NestJS API orqali ishlaydi.

## 1. `.env` fayllarini tozalash

### Frontend (`.env`)

```env
VITE_API_URL=http://localhost:4000/api

VITE_SUPER_ADMIN_PHONE=+998900707081
VITE_SUPER_ADMIN_PASSWORD=your_password
VITE_SUPER_ADMIN_EMAIL=superadmin@qulay-ish.local

VITE_USE_EMULATOR=false
VITE_AI_MOCK_MODE=true
```

**O'chiring:** barcha `VITE_FIREBASE_*` va `VITE_FIRESTORE_*` qatorlari.

### API (`api/.env`)

```env
DATABASE_URL=postgresql://qulay_ish:qulay_ish_dev@localhost:5432/qulay_ish
JWT_SECRET=change-me-in-production
JWT_EXPIRES_IN=7d
API_PORT=4000
CORS_ORIGIN=http://localhost:3000

SUPER_ADMIN_EMAIL=superadmin@qulay-ish.local
SUPER_ADMIN_PASSWORD=your_password
SUPER_ADMIN_PHONE=+998900707081

OTP_DEV_RETURN=false
```

## 2. PostgreSQL ishga tushirish

```bash
npm run db:up
npm run api:install
cd api && npx prisma migrate deploy
cd api && npx prisma generate
```

## 3. Firebase dan ma'lumot ko'chirish (bir martalik)

Bu qadam faqat eski ma'lumotlarni ko'chirish uchun. Keyin Firebase o'chiriladi.

### 3a. Service account JSON

`secrets/firebase-service-account.json` faylini yarating yoki root `.env` ga qo'shing:

```env
FIREBASE_PROJECT_ID=gen-lang-client-0528497200
FIRESTORE_DATABASE_ID=ai-studio-4c1b1226-dd9d-4904-bc52-80793df46787
FIREBASE_SERVICE_ACCOUNT_PATH=./secrets/firebase-service-account.json
```

Yoki to'liq JSON:

```env
FIREBASE_SERVICE_ACCOUNT={"type":"service_account",...}
```

### 3b. Export va import

```bash
npm run export:firestore
npm run db:seed
```

Natija: `data/firestore-export/*.json` yaratiladi va PostgreSQL ga yoziladi.

### 3c. Tekshirish

```bash
curl http://localhost:4000/api/stats/counts
```

Admin panelda foydalanuvchilar, ishlar va arizalar ko'rinishi kerak.

## 4. Ilovani ishga tushirish

```bash
# Terminal 1 — API
npm run api:dev

# Terminal 2 — Frontend
npm run dev
```

- Frontend: http://localhost:3000
- API: http://localhost:4000/api
- Super Admin: http://localhost:3000/super-admin/login

## 5. OTP autentifikatsiya (dev)

SMS hali ulangan emas. OTP kodi API terminalida chiqadi:

```
[OTP] +998... uchun kod: 123456
```

## 6. Firebase ni butunlay o'chirish

Quyidagilar bajarilgandan keyin Firebase loyihasini o'chirishingiz mumkin:

- [ ] `npm run export:firestore` muvaffaqiyatli
- [ ] `npm run db:seed` muvaffaqiyatli
- [ ] Admin panelda barcha ma'lumotlar ko'rinadi
- [ ] Login/OTP ishlaydi
- [ ] `.env` dan Firebase o'zgaruvchilari o'chirilgan

## Arxitektura

```
React (Vite)  →  NestJS API (:4000)  →  PostgreSQL (:5432)
```

Eski Firebase fayllari (`firebase.json`, `functions/`) repoda qolishi mumkin, lekin ilova ularni ishlatmaydi.
