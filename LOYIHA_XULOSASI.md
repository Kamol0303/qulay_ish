# ishliayol.uz — Umumiy xulosa (sayt + APK + tizim)

**Loyiha nomi:** ishliayol.uz  
**Repo:** https://github.com/Kamol0303/qulay_ish  
**Branch:** `main`  
**Maqsad:** Samarqand uchun ishchi–ish beruvchi onlayn platforma. Brauzer (sayt) va Android ilova (APK) **bir xil backend va bir xil ma’lumotlar bazasi** bilan ishlaydi.

---

## 1. Loyiha nima?

**ishliayol.uz** — ish e’lonlari, arizalar, shartnomalar, chat, shaxsni tasdiqlash va admin boshqaruvi bo‘lgan marketplace.

| Tomon | Vazifa |
|-------|--------|
| **Ishchi (worker)** | Profil, ish qidirish, ariza, shartnoma, xabarlar |
| **Ish beruvchi (employer)** | E’lon joylash, arizalarni ko‘rish, shartnoma |
| **Admin / Super Admin** | Foydalanuvchilar, verification, nizolar, sozlamalar, loglar |

**Asosiy qoida:** APK orqali kiritilgan ma’lumot saytda, saytda kiritilgan ma’lumot APK da ko‘rinadi — chunki ular bitta tizimning ikki “old tomoni”.

---

## 2. Sayt haqida umumiy xulosalar

### 2.1 Texnologiyalar

| Qatlam | Stack |
|--------|--------|
| Frontend | React 19 + TypeScript + Vite 6 + Tailwind CSS 4 |
| Routing | React Router 7 (`BrowserRouter`) |
| State | React Context (`AuthContext`) — Redux/Zustand yo‘q |
| i18n | o‘zbek / rus / ingliz |
| Backend | NestJS 11 (papka: `api/`) |
| ORM / DB | Prisma 6 + **PostgreSQL** |
| Auth | JWT Bearer + bcrypt parol + SMS OTP (DevSMS) |
| Fayllar | Lokal disk (`uploads/public`, `uploads/private`) |
| Production | https://ishliayol.uz → nginx → Nest (`:4000`) + static `dist/` |

### 2.2 Sayt nimalarni qamrab oladi

- Landing, ishlar ro‘yxati, ishchi profillari, statistika, kurslar (kontent)
- Auth: register (OTP majburiy), login (telefon/email + parol), parol tiklash (OTP)
- Verification: passport + selfie — **tasdiqlanmaguncha** ish/ariza bloklanadi
- Worker / Employer dashboardlar, service posts, saved jobs
- Shartnomalar, nizolar, reviews, notifications, chat (HTTP polling)
- Admin va Super Admin panellari
- Favicon / brending: Samarqand gerbi, brend nomi **ishliayol.uz**

### 2.3 Sayt arxitekturasi (sodda chizma)

```
Brauzer (localhost:3000 yoki ishliayol.uz)
        │  HTTPS / JWT
        ▼
   NestJS API  (/api)
        │
        ▼
   PostgreSQL  (yagona baza)
```

Frontend alohida SPA; backend alohida API. SSR monolit emas.

### 2.4 Sayt bo‘yicha muhim xulosalar

1. **API tayyor** — asosiy CRUD (users, jobs, applications, contracts, verification, chat, …) REST orqali bor.
2. **Xavfsizlik asoslari** — JWT, bcrypt, OTP limit, private uploadlar JWT orqali, production HTTPS (nginx).
3. **Real-time yo‘q** — chat/notification polling (5–15 soniya); WebSocket keyinroq qo‘shilishi mumkin.
4. **To‘lov gateway yo‘q** — Payme/Click faqat tip/stub darajasida; real integratsiya keyingi bosqich.
5. **Demo/mock olib tashlangan** — localStorage “soxta baza” production/APK uchun ishlatilmaydi; ma’lumot faqat API orqali.
6. **Bitta manba** — sayt ham, APK ham shu Nest + PostgreSQL ga ulanadi.

---

## 3. APK haqida (qurilishi va mohiyati)

### 3.1 Nima tanlandi?

**Capacitor** (Variant A): mavjud React sayt `dist/` qilib yig‘iladi va Android WebView “shell” ichiga joylanadi.

| Band | Qiymat |
|------|--------|
| App ID | `uz.ishliayol.app` |
| App nomi | ishliayol.uz |
| UI kodi | Sayt bilan **bir xil** `src/` |
| API | `https://ishliayol.uz/api` (absolute HTTPS) |
| Nega Capacitor? | Bitta frontend = sinxron kafolat, tez APK, barcha sahifalar darhol |

React Native (Expo) keyinroq mumkin (push/offline uchun), lekin hozirgi talab uchun Capacitor eng to‘g‘ri.

### 3.2 APK qanday “ishlaydi”?

```
Android telefon
  └─ Capacitor WebView
        └─ Vite build (dist/)  ← saytning o‘zi
              │
              │  HTTPS + JWT
              ▼
        https://ishliayol.uz/api  →  NestJS  →  PostgreSQL
```

- Offline’da UI ochilishi mumkin, lekin **ma’lumot serverdan** keladi.
- Login token: `localStorage` + Capacitor Preferences.
- Back tugmasi, splash, status bar, offline banner — nativ plaginlar orqali.

### 3.3 APK qurilish bosqichlari

| # | Qadam | Buyruq / izoh |
|---|--------|----------------|
| 1 | JDK 21 | `sudo apt install openjdk-21-jdk` (Kali: Java 25 JRE yetarli emas) |
| 2 | Android SDK | `./scripts/setup-android-sdk.sh` → `~/Android/Sdk` |
| 3 | Env | `JAVA_HOME`, `ANDROID_HOME` |
| 4 | Web build | `vite build --mode capacitor` → `VITE_API_URL=https://ishliayol.uz/api` |
| 5 | Sync | `npx cap sync android` |
| 6 | Gradle | `assembleDebug` yoki `assembleRelease` |
| 7 | Natija | `artifacts/ishliayol-*-latest.apk` |

**Bitta buyruq:**

```bash
cd ~/Desktop/qulay_ish
export JAVA_HOME=/usr/lib/jvm/java-21-openjdk-amd64
export ANDROID_HOME=$HOME/Android/Sdk
export PATH="$JAVA_HOME/bin:$ANDROID_HOME/cmdline-tools/latest/bin:$ANDROID_HOME/platform-tools:$PATH"

./scripts/setup-android-sdk.sh   # birinchi marta
./scripts/build-apk.sh release
ls -lh artifacts/ishliayol-release-latest.apk
```

### 3.4 APK fayl qayerda va qanday ulashish

| Fayl | Yo‘l |
|------|------|
| Release (tavsiya) | `artifacts/ishliayol-release-latest.apk` |
| Debug | `artifacts/ishliayol-debug-latest.apk` |
| Gradle | `android/app/build/outputs/apk/...` |

**Ulashish:** Telegram, Google Drive, Mega — link yoki fayl.  
`gh` (GitHub CLI) shart emas. Qabul qiluvchi “noma’lum manbalardan o‘rnatish”ga ruxsat beradi.

### 3.5 APK xavfsizlik

- Faqat HTTPS (`cleartext: false`)
- `network_security_config.xml` — cleartext taqiqlangan
- WebView debug **faqat DEBUG** buildda
- Release: R8/ProGuard minify
- Keystore / `key.properties` — **repo ga commit qilinmaydi**
- Navigatsiya whitelist: `ishliayol.uz`, localhost

---

## 4. Autentifikatsiya va rollar

| Oqim | Qanday |
|------|--------|
| Register | Telefon + parol → SMS OTP → user yaratiladi |
| Login | Telefon/email + parol → JWT |
| Parol tiklash | OTP `reset` → yangi parol |
| Super Admin | `/super-admin-login` — `api/.env` dagi `SUPER_ADMIN_*` |
| Token | `Authorization: Bearer ...`, muddat odatda 30 kun |

**Rollar:** `worker` · `employer` · `admin` · `super_admin`

---

## 5. Ma’lumotlar (qisqa)

PostgreSQL modellari (asosiy):  
`User`, `Job`, `Application`, `Contract`, `Dispute`, `ServicePost`, `ChatMessage`, `Notification`, `VerificationRequest`, `Review`, `SavedJob`, `Payment` (stub), loglar, OTP sessiyalar.

`User` — markaziy hub (ishlar, arizalar, shartnomalar, chat, verification…).

---

## 6. Lokal ishga tushirish (sayt)

Batafsil: [`SETUP.md`](./SETUP.md)

```bash
git clone https://github.com/Kamol0303/qulay_ish.git
cd qulay_ish
git checkout main && git pull origin main

npm install
cd api && npm install && cd ..

# Muhit fayllarini yarating (api/.env majburiy)
# DATABASE_URL, JWT_SECRET, SUPER_ADMIN_*, CORS_ORIGIN

npm run db:setup
npm run dev
```

| Xizmat | URL |
|--------|-----|
| Sayt | http://localhost:3000 |
| API | http://localhost:4000/api |
| Super Admin | http://localhost:3000/super-admin-login |

---

## 7. Production

| Band | Holat |
|------|--------|
| Domen | https://ishliayol.uz |
| Proxy | `nginx-config.conf` — `/api` → Nest 4000, static → `dist/` |
| TLS | Let’s Encrypt (nginx) |
| APK API | Xuddi shu domen: `https://ishliayol.uz/api` |

---

## 8. Hujjatlar xaritasi

| Fayl | Mazmun |
|------|--------|
| **LOYIHA_XULOSASI.md** (shu fayl) | Umumiy xulosa — sayt + APK |
| [`SETUP.md`](./SETUP.md) | Clone, env, DB, ishga tushirish |
| [`MOBILE.md`](./MOBILE.md) | APK build, Kali JDK/SDK |
| [`AUDIT.md`](./AUDIT.md) | Texnik audit (stack, API, xavfsizlik) |
| [`ARCHITECTURE_DECISION.md`](./ARCHITECTURE_DECISION.md) | Nega Capacitor |
| [`README.md`](./README.md) | Qisqa kirish |
| [`nginx-config.conf`](./nginx-config.conf) | Production nginx |

---

## 9. Skriptlar

| Skript | Vazifa |
|--------|--------|
| `npm run dev` / `scripts/dev.sh` | Postgres + API + frontend |
| `npm run db:setup` | PostgreSQL + migratsiya |
| `scripts/setup-android-sdk.sh` | Android SDK o‘rnatish |
| `scripts/build-apk.sh debug\|release` | APK yig‘ish |
| `scripts/start-all.sh` | Dev stack yordamchi |

---

## 10. Nima bor / nima yo‘q (holat)

### Bor
- To‘liq web platforma (worker/employer/admin)
- REST API + PostgreSQL
- OTP auth, verification gate
- Capacitor Android loyihasi + build skriptlari
- Sayt ↔ APK bitta backend

### Yo‘q / keyingi bosqich
- Real Payme/Click to‘lov
- WebSocket real-time chat
- Push notification (FCM) — ixtiyoriy “killer” bosqich
- Expo/RN to‘liq nativ rewrite
- iOS (Capacitor iOS qo‘shish mumkin, alohida Mac kerak)

---

## 11. Yakuniy xulosa

1. **Sayt** — ishlab chiqilgan, API-asosida, production domeni `ishliayol.uz`.  
2. **APK** — saytning Capacitor qobig‘i; alohida baza yo‘q; ma’lumot faqat serverdan.  
3. **Sinxron** — bir tizim, ikki klient (brauzer + Android).  
4. **Qurish** — JDK 21 + Android SDK + `./scripts/build-apk.sh release` → `artifacts/*.apk`.  
5. **Ulashish** — APK faylini Drive/Telegram orqali berish kifoya.

Savol bo‘lsa: avval `SETUP.md` (sayt), keyin `MOBILE.md` (APK).
