# ishliayol.uz — To‘liq clone va ishga tushirish qo‘llanmasi

Bitta backend (NestJS) + bitta PostgreSQL. Brauzer va Android APK shu manbaga ulanadi.

---

## 1. Talablar (kompyuterda bo‘lishi kerak)

| Dastur | Versiya | Tekshirish |
|--------|---------|------------|
| Git | — | `git --version` |
| Node.js | **20+** | `node -v` |
| npm | 10+ | `npm -v` |
| Docker | (PostgreSQL uchun) | `docker --version` |
| JDK | 21 (faqat APK uchun) | `java -version` |
| Android SDK | (faqat APK uchun) | `echo $ANDROID_HOME` |

Windows: Git Bash yoki WSL tavsiya etiladi.

---

## 2. Reponi clone qilish

```bash
cd ~/Desktop
git clone https://github.com/Kamol0303/qulay_ish.git
cd qulay_ish
```

Asosiy ishlaydigan branch:

```bash
git checkout main
git pull origin main
```

Agar mobil/APK o‘zgarishlari PR branchda bo‘lsa:

```bash
git fetch origin
git checkout cursor/mobile-apk-audit-34da
git pull origin cursor/mobile-apk-audit-34da
```

---

## 3. Paketlarni o‘rnatish

**Repo ildizidan** (muhim — `api/` ichida emas):

```bash
cd ~/Desktop/qulay_ish

# Frontend + umumiy
npm install

# Backend
cd api
npm install
cd ..
```

---

## 4. Environment fayllar

### 4.1 Frontend (ildiz `.env`)

```bash
cp .env.example .env
```

Minimal `.env`:

```env
VITE_API_URL=/api
VITE_APP_URL=http://localhost:3000
VITE_AI_MOCK_MODE=false
VITE_USE_EMULATOR=false

VITE_SUPER_ADMIN_EMAIL=superadmin@ishliayol.uz
VITE_SUPER_ADMIN_PHONE=+998900707081
VITE_SUPER_ADMIN_PASSWORD=Hur_135642
```

> Parolni o‘zingiznikiga almashtiring. Frontenddagi `VITE_SUPER_ADMIN_*` faqat eslatma — **haqiqiy tekshiruv** `api/.env` da.

### 4.2 Backend (`api/.env`)

```bash
cp api/.env.example api/.env
```

Minimal `api/.env`:

```env
DATABASE_URL=postgresql://qulay_ish:qulay_ish_dev@localhost:5432/qulay_ish

JWT_SECRET=change-me-in-production-use-long-random
JWT_EXPIRES_IN=30d

API_PORT=4000
CORS_ORIGIN=http://localhost:3000,http://127.0.0.1:3000,https://localhost,capacitor://localhost

SUPER_ADMIN_EMAIL=superadmin@ishliayol.uz
SUPER_ADMIN_PHONE=+998900707081
SUPER_ADMIN_PASSWORD=Hur_135642

# SMS OTP (bo'sh bo'lsa — lokalda OTP API konsoliga chiqadi)
DEVSMS_TOKEN=
DEVSMS_BASE_URL=https://devsms.uz/api
DEVSMS_SERVICE_NAME=ishliayol.uz
```

**Muhim:** `SUPER_ADMIN_PASSWORD` ni o‘zgartirsangiz, API ni **qayta ishga tushiring**.

---

## 5. Ma’lumotlar bazasi (PostgreSQL)

Docker orqali (tavsiya):

```bash
cd ~/Desktop/qulay_ish
npm run db:setup
```

Bu odatda:

1. Postgres konteynerini ko‘taradi  
2. Prisma migrate qiladi  

Qo‘lda migratsiya:

```bash
cd api
npx prisma migrate deploy
npx prisma generate
cd ..
```

Tekshirish:

```bash
# Postgres tinglayaptimi?
pg_isready -h localhost -p 5432
# yoki
docker ps | grep -i postgres
```

---

## 6. Loyihani ishga tushirish (sayt + API)

### Variant A — bitta buyruq (tavsiya)

```bash
cd ~/Desktop/qulay_ish
npm run dev
```

Bu odatda Postgres → API (4000) → Vite (3000) ketma-ketligini ishga tushiradi.

| Xizmat | URL |
|--------|-----|
| Frontend | http://localhost:3000 |
| API | http://localhost:4000/api |
| Health/stats | http://localhost:4000/api/stats/counts |

### Variant B — alohida terminallar

**Terminal 1 — DB**

```bash
npm run db:up
# yoki: npm run db:setup
```

**Terminal 2 — API**

```bash
npm run api:dev
```

**Terminal 3 — Frontend**

```bash
npm run dev:web
```

---

## 7. Kirish (login)

### Super Admin

1. Brauzer: http://localhost:3000/super-admin-login  
2. Email: `superadmin@ishliayol.uz` **yoki** telefon: `+998900707081`  
3. Parol: `api/.env` dagi `SUPER_ADMIN_PASSWORD` (yuqoridagi misolda `Hur_135642`)

### Oddiy foydalanuvchi (worker / employer)

1. http://localhost:3000/auth?mode=register  
2. Telefon + parol (min 8) → **OTP SMS** → tasdiqlash  
3. Keyin: http://localhost:3000/auth?mode=login — telefon + parol  

Lokalda `DEVSMS_TOKEN` bo‘sh bo‘lsa OTP **API terminalida** `[DEV OTP]` sifatida chiqadi.

---

## 8. To‘xtatish

```bash
# npm run dev ishlayotgan terminalda
Ctrl + C

# Postgres konteynerini to‘xtatish
npm run db:down
```

---

## 9. Android APK (ixtiyoriy)

Sayt va APK **bir xil** production API ga ulanadi: `https://ishliayol.uz/api`.

Batafsil: [`MOBILE.md`](./MOBILE.md)

```bash
cd ~/Desktop/qulay_ish

# JDK 21 + Android SDK o‘rnatilgan bo‘lishi kerak
export ANDROID_HOME=/opt/android-sdk   # o‘z yo‘lingiz

chmod +x scripts/build-apk.sh
./scripts/build-apk.sh debug     # debug APK
./scripts/build-apk.sh release   # imzolangan release APK
```

Chiqish:

- `android/app/build/outputs/apk/debug/app-debug.apk`
- `android/app/build/outputs/apk/release/app-release.apk`

Telefoningizga `.apk` ni o‘rnating → login → saytda shu akkaunt ko‘rinishi kerak.

---

## 10. Tez-tez uchraydigan xatolar

### `Cannot POST /auth/...` yoki 404

API ishlamayapti yoki noto‘g‘ri URL. Tekshiring:

```bash
curl http://localhost:4000/api/stats/counts
```

### Super Admin kirmayapti

1. `api/.env` dagi email/parolni tekshiring  
2. API ni qayta ishga tushiring (`npm run api:dev`)  
3. Telefon bilan urinib ko‘ring: `+998900707081`

### `Can't reach database` / Prisma xato

```bash
npm run db:setup
cd api && npx prisma migrate deploy && cd ..
```

### Port 3000 yoki 4000 band

Eski `node`/`vite` jarayonini to‘xtating, qayta `npm run dev`.

### `npm run db:setup` — repo ildizidan

`api/` papkasida emas, **root** da ishlating:

```bash
cd ~/Desktop/qulay_ish
npm run db:setup
```

### Git yangilash

```bash
cd ~/Desktop/qulay_ish
git pull origin main
npm install
cd api && npm install && npx prisma migrate deploy && cd ..
```

---

## 11. Qisqa cheklist

```text
[ ] git clone
[ ] git checkout main && git pull
[ ] npm install && cd api && npm install && cd ..
[ ] cp .env.example .env
[ ] cp api/.env.example api/.env   (+ parollarni to‘ldirish)
[ ] npm run db:setup
[ ] npm run dev
[ ] Brauzer: http://localhost:3000
[ ] Super Admin: /super-admin-login
```

---

## 12. Qo‘shimcha hujjatlar

| Fayl | Mazmun |
|------|--------|
| [`README.md`](./README.md) | Qisqa kirish |
| [`MOBILE.md`](./MOBILE.md) | APK build |
| [`AUDIT.md`](./AUDIT.md) | Kod bazasi auditi |
| [`ARCHITECTURE_DECISION.md`](./ARCHITECTURE_DECISION.md) | Mobil arxitektura |
| [`nginx-config.conf`](./nginx-config.conf) | Production (ishliayol.uz) |
