# Mexrli Qo'llar.uz

Ish platformasi: **Vite/React + NestJS + PostgreSQL + Capacitor**.  
Sayt, APK va iOS — bitta API: `https://ishliayol.uz/api`.

---

## Tezkor yo‘l (Kali)

```bash
# 1) Java 21
sudo apt update && sudo apt install -y openjdk-21-jdk git curl wget unzip
source scripts/env-kali.sh   # yoki: export JAVA_HOME=... (pastda)

# 2) Kod
cd ~/Desktop/qulay_ish
git remote set-url origin https://github.com/Kamol0303/qulay_ish.git
git fetch origin main && git reset --hard origin/main
chmod +x scripts/*.sh

# 3) Env + paketlar
./scripts/write-local-envs.sh
npm install && (cd api && npm install)

# 4) Android SDK (bir marta)
./scripts/setup-android-sdk.sh
source scripts/env-kali.sh

# 5) APK
./scripts/build-apk.sh debug
ls -lh artifacts/mexrliqollar-debug-latest.apk
```

Release: `./scripts/build-apk.sh release`

---

## Env fayllar

| Fayl | Nima uchun |
|------|------------|
| `.env` | Lokal sayt → `/api` |
| `.env.capacitor` | APK → `https://ishliayol.uz/api` |
| `api/.env` | Nest + **SMS token** (`DEVSMS_*`) |

Yaratish: `./scripts/write-local-envs.sh`  
Namuna: `.env.example`, `.env.capacitor.example`, `api/.env.example`

`api/.env` SMS (majburiy):

```env
DEVSMS_TOKEN=...
DEVSMS_BASE_URL=https://devsms.uz/api
DEVSMS_SERVICE_NAME=Mexrli Qollar
DEVSMS_DEV_MODE=false
```

Tekshiruv: `./scripts/check-otp.sh`

---

## Lokal sayt

```bash
source scripts/env-kali.sh
npm run db:up
# terminal 1
cd api && npm run start:dev
# terminal 2
npm run dev:web
```

- http://localhost:3000  
- http://localhost:4000/api  
- Super Admin: `/super-admin-login` (`api/.env` → `SUPER_ADMIN_*`)

---

## OTP SMS (APK)

APK SMS yubormaydi. Server (`ishliayol.uz`) dagi Nest `api/.env` ishlashi shart.

```bash
ssh USER@185.203.237.57
cd /LOYIHA_PAPKA
git fetch origin main && git reset --hard origin/main
# api/.env ga DEVSMS_TOKEN + DEVSMS_SERVICE_NAME=Mexrli Qollar
FORCE_PROD_REDEPLOY=1 ./scripts/redeploy-api-production.sh
curl -s https://ishliayol.uz/api/auth/sms-status   # configured:true
```

Keyin: `./scripts/build-apk.sh release`

---

## iOS

```bash
./scripts/build-ios.sh sync     # Kali/Linux — faqat loyiha
./scripts/build-ios.sh open     # faqat macOS + Xcode
```

IPA Telegram orqali o‘rnatilmaydi (TestFlight/App Store).

---

## Skriptlar

| Buyruq | Vazifa |
|--------|--------|
| `scripts/env-kali.sh` | `JAVA_HOME` + `ANDROID_HOME` |
| `scripts/write-local-envs.sh` | 3 ta env yozish |
| `scripts/check-otp.sh` | SMS/env diagnostika |
| `scripts/setup-android-sdk.sh` | Android SDK |
| `scripts/build-apk.sh` | `debug` / `release` |
| `scripts/build-ios.sh` | `sync` / `open` / `archive` |
| `scripts/redeploy-api-production.sh` | VPS API |

---

## Papkalar

```
src/          frontend (+ src/mobile/)
api/          NestJS + prisma + uploads/
android/      Capacitor Android
ios/          Capacitor iOS
scripts/      build / env / deploy
artifacts/    tayyor APK chiqishi
public/       statik assetlar
plugins/      Vite Nest proxy
```

---

## Xatolar

| Muammo | Yechim |
|--------|--------|
| `javac` yo‘q | `openjdk-21-jdk` + `source scripts/env-kali.sh` |
| SDK yo‘q | `./scripts/setup-android-sdk.sh` |
| APK OTP yo‘q | VPS `api/.env` + redeploy; `sms-status` → true |
| Git SSH xato | `git remote set-url origin https://github.com/Kamol0303/qulay_ish.git` |
