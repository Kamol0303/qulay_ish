# Mexrli Qo'llar.uz (`qulay_ish`)

Samarqand ish platformasi — **React (Vite) + NestJS + PostgreSQL + Capacitor**.  
Brauzer, Android APK va iOS loyihasi **bir xil** `https://ishliayol.uz/api` va bir xil PostgreSQL bilan ishlaydi.

| | |
|--|--|
| App ID | `uz.mexrliqollar.app` |
| Brend | Mexrli Qo'llar.uz |
| Production API | `https://ishliayol.uz/api` |
| Repo | `https://github.com/Kamol0303/qulay_ish` |

---

## 1) Kali — bir marta o‘rnatish

```bash
sudo apt update
sudo apt install -y openjdk-21-jdk git curl wget unzip

export JAVA_HOME=/usr/lib/jvm/java-21-openjdk-amd64
export PATH="$JAVA_HOME/bin:$PATH"
java -version
javac -version   # majburiy
```

```bash
cd ~/Desktop/qulay_ish
git remote set-url origin https://github.com/Kamol0303/qulay_ish.git
git fetch origin main
git reset --hard origin/main
chmod +x scripts/*.sh

./scripts/write-local-envs.sh
npm install
cd api && npm install && cd ..

./scripts/setup-android-sdk.sh
export ANDROID_HOME=$HOME/Android/Sdk
export PATH="$JAVA_HOME/bin:$ANDROID_HOME/cmdline-tools/latest/bin:$ANDROID_HOME/platform-tools:$PATH"
```

Har yangi terminalda:

```bash
export JAVA_HOME=/usr/lib/jvm/java-21-openjdk-amd64
export ANDROID_HOME=$HOME/Android/Sdk
export PATH="$JAVA_HOME/bin:$ANDROID_HOME/cmdline-tools/latest/bin:$ANDROID_HOME/platform-tools:$PATH"
```

---

## 2) Env fayllar

| Fayl | Vazifa |
|------|--------|
| `.env` | Lokal Vite → `VITE_API_URL=/api` |
| `.env.capacitor` | APK/iOS bake → `https://ishliayol.uz/api` |
| `api/.env` | Nest + **DEVSMS_TOKEN** (OTP SMS shu yerda) |

Yozish:

```bash
./scripts/write-local-envs.sh
```

`api/.env` da SMS uchun majburiy:

```env
DEVSMS_TOKEN=...
DEVSMS_BASE_URL=https://devsms.uz/api
DEVSMS_SERVICE_NAME=Mexrli Qollar
DEVSMS_DEV_MODE=false
```

Tekshiruv:

```bash
./scripts/check-otp.sh
```

---

## 3) Lokal sayt

```bash
cd ~/Desktop/qulay_ish
npm run db:up          # PostgreSQL (Docker)
cd api && npm run start:dev
```

Boshqa terminal:

```bash
cd ~/Desktop/qulay_ish
npm run dev:web
```

- Sayt: http://localhost:3000  
- API: http://localhost:4000/api  
- Super Admin: http://localhost:3000/super-admin-login  

Yoki birgalikda: `npm run dev`

---

## 4) Android APK yaratish

```bash
cd ~/Desktop/qulay_ish
git fetch origin main && git reset --hard origin/main

export JAVA_HOME=/usr/lib/jvm/java-21-openjdk-amd64
export ANDROID_HOME=$HOME/Android/Sdk
export PATH="$JAVA_HOME/bin:$ANDROID_HOME/cmdline-tools/latest/bin:$ANDROID_HOME/platform-tools:$PATH"

./scripts/write-local-envs.sh
./scripts/build-apk.sh debug
# yoki: ./scripts/build-apk.sh release

ls -lh artifacts/mexrliqollar-*-latest.apk
```

Telefon: `artifacts/mexrliqollar-debug-latest.apk` yoki `mexrliqollar-release-latest.apk`  
Telegram orqali APK yuborib o‘rnatish mumkin.

---

## 5) OTP SMS (production VPS — majburiy)

APK SMS ni o‘zi yubormaydi — `https://ishliayol.uz/api` dagi Nest + `api/.env` dagi DevSMS token ishlashi shart.

```bash
ssh USER@185.203.237.57
# USER = root / ubuntu (to'g'ri parol yoki SSH kalit)

find /var/www /home /opt /root -maxdepth 4 -type d \( -name 'qulay_ish' -o -name 'qulay-ish' \) 2>/dev/null
cd /TOPILGAN/PAPKA

git remote set-url origin https://github.com/Kamol0303/qulay_ish.git
git fetch origin main && git reset --hard origin/main

# api/.env — DEVSMS_TOKEN va DEVSMS_SERVICE_NAME=Mexrli Qollar
FORCE_PROD_REDEPLOY=1 ./scripts/redeploy-api-production.sh

curl -s https://ishliayol.uz/api/auth/sms-status
# "configured":true bo'lishi kerak
```

Keyin Kali’da:

```bash
./scripts/check-otp.sh
./scripts/build-apk.sh release
```

---

## 6) iOS

Loyiha: `ios/` (Capacitor).  
**IPA faqat macOS + Xcode** da yig‘iladi. Kali’da:

```bash
./scripts/build-ios.sh sync
```

Mac da: `./scripts/build-ios.sh open` → Signing → Run / Archive.  
Telegramga `.ipa` tashlab o‘rnatib bo‘lmaydi — TestFlight / App Store kerak.

---

## 7) Asosiy skriptlar

| Skript | Vazifa |
|--------|--------|
| `scripts/write-local-envs.sh` | `.env` / `.env.capacitor` / `api/.env` |
| `scripts/check-otp.sh` | Env + DevSMS + production SMS diagnostika |
| `scripts/setup-android-sdk.sh` | Android SDK |
| `scripts/build-apk.sh` | `debug` / `release` APK |
| `scripts/build-ios.sh` | `sync` / `open` / `archive` |
| `scripts/redeploy-api-production.sh` | VPS da Nest API yangilash |
| `scripts/fix-otp-sms.sh` | DevSMS env + API rebuild |

npm:

```bash
npm run dev              # stack
npm run db:setup         # Postgres + migrate
npm run api:dev          # faqat API
npm run dev:web          # faqat frontend
./scripts/build-apk.sh debug
./scripts/build-apk.sh release
```

---

## 8) Arxitektura (qisqa)

```
Brauzer / Android APK / iOS
        │  HTTPS + JWT
        ▼
https://ishliayol.uz/api  →  NestJS  →  PostgreSQL
        │
   DevSMS (OTP SMS)
```

- Frontend: `src/` (mobil UI: `src/mobile/`)
- API: `api/`
- Android: `android/`
- iOS: `ios/`
- Production nginx namunasi: `nginx-config.conf`

---

## 9) Tez xato-javob

| Xato | Yechim |
|------|--------|
| `javac yo'q` / Java 25 | `sudo apt install -y openjdk-21-jdk` + `JAVA_HOME` |
| `Android SDK topilmadi` | `./scripts/setup-android-sdk.sh` |
| `@capacitor/haptics` | `npm install` (build-apk o‘zi ham qiladi) |
| APK OTP SMS kelmaydi | VPS `api/.env` DEVSMS + redeploy; `sms-status` → configured:true |
| `Permission denied (publickey)` | `git remote set-url origin https://github.com/Kamol0303/qulay_ish.git` |
| SSH VPS parol rad | Hosting panel / boshqa user / parol reset |

---

## 10) Super Admin (lokal)

`api/.env` dagi qiymatlar:

- URL: `/super-admin-login`
- Email / telefon / parol: `SUPER_ADMIN_*`
