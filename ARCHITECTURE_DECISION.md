# ARCHITECTURE_DECISION.md — Bosqich 1

**Sana:** 2026-08-08  
**Asos:** `AUDIT.md` (tasdiqlangan)  
**Buzilmas talab:** Mobil APK va veb-sayt **bir xil NestJS API + bir xil PostgreSQL** bilan ishlaydi. Mock / alohida baza / local-only “haqiqiy” ma’lumot — taqiqlangan.

---

## 1. Qaror daraxti bo‘yicha holat

| Savol | Audit javobi |
|-------|----------------|
| To‘liq REST API bormi? | **Ha** — NestJS `/api`, asosiy CRUD qoplangan |
| SSR monolitmi? | **Yo‘q** — Vite SPA + alohida API |
| Daraxtning “API bor” tarmog‘i | React Native (Expo) |
| Daraxtning “API yo‘q” tarmog‘i | Capacitor (A) yoki API + RN (B) |

Rasmiy daraxt **Expo** ni ko‘rsatadi. Shu bilan birga sizning bosh talabingiz — *“huddi o‘sha tizimning ikkita old tomoni”* va *barcha sayt funksiyalari* — eng qattiq metrika.

---

## 2. Tanlangan yo‘l

### Qaror: **Variant A — Capacitor.js (mavjud React SPA ni Android WebView shell ga o‘rash)**

| Band | Qiymat |
|------|--------|
| **Tanlov** | Capacitor 7 + mavjud Vite/React frontend |
| **Backend** | O‘zgarishsiz: `https://mexrliqollar.uz/api` → NestJS → PostgreSQL |
| **UI kod** | Bitta `src/` — sayt va APK bir xil builddan |
| **Keyingi evolyutsiya** | Kerak bo‘lsa keyin Expo/RN ga bosqichma-bosqich (Variant B+) |

---

## 3. Nima uchun Capacitor (Expo emas) — sabab-oqibat

### 3.1 Bosh talabga eng to‘g‘ri moslashuv

| Mezon | Capacitor (A) | React Native Expo |
|-------|---------------|-------------------|
| Bir xil API chaqiriqlari | **Kafolat** — xuddi shu `src/lib/api` | Qayta yoziladi → drift xavfi |
| Sayt ↔ APK ma’lumot sinxroni | Avtomatik (bitta client) | Faqat intizom bilan |
| Barcha sahifalar (admin, verification, contracts, i18n) | Darhol | Qayta implement |
| Demo/mock xavfini bartaraf etish | Bir joyda (`src/`) | Ikki joyda (web + mobile) |
| Production APK tezligi | Tez (shell + build) | Sekinroq (to‘liq rewrite) |
| Native UX / offline-first / push | Cheklanganroq | Kuchliroq |

**Xulosa:** Auditda API borligi Expo ni “mumkin” qiladi, lekin **bosh talab** “ikkita frontend, bitta manba” emas — “**bitta frontend kodining** ikkita ishga tushirish muhiti”. Capacitor shu modelni beradi.

### 3.2 Nima uchun daraxtning Expo tarmog‘idan chetga chiqdik

1. **API allaqachon SPA uchun yozilgan** — qayta RN client yozish biznes-logikani emas, UI ni ikki marta saqlashni bildiradi.  
2. Admin / super-admin / verification / shartnoma oqimlari katta — Expo da “to‘liq paritet” uzoq va xavfli.  
3. Demo/mock (`demoStore`, `DEMO_JOBS`) allaqachon bitta `src/` da — ularni bir marta o‘chirish sayt+APK ni tozalaydi.  
4. Expo keyinroq ochiq qoladi: API barqaror, kontraktlar hujjatlangan (`AUDIT.md` §4).

### 3.3 Backend o‘zgarishi kerakmi?

**Minimal.** Yangi REST qatlami shart emas (API bor). Bosqich 2 da faqat:

- CORS ga Capacitor origin / `capacitor://` / Android WebView origin qo‘shish (kerak bo‘lsa)
- Production uchun absolute API URL
- (Ixtiyoriy) health endpoint, upload URL absolute qilish

Bu “tabiiy qism” — yangi biznes API emas.

---

## 4. Maqsadli arxitektura (target)

```
┌─────────────────────┐     ┌─────────────────────┐
│  Brauzer (mexrliqollar)│     │  Android APK        │
│  Vite React SPA     │     │  Capacitor WebView  │
│  dist/              │     │  xuddi shu dist/    │
└─────────┬───────────┘     └─────────┬───────────┘
          │  HTTPS + JWT              │  HTTPS + JWT
          └────────────┬──────────────┘
                       ▼
              ┌────────────────┐
              │ NestJS /api    │
              │ JWT + RBAC     │
              └────────┬───────┘
                       ▼
              ┌────────────────┐
              │ PostgreSQL     │
              │ (yagona baza)  │
              └────────────────┘
```

**Qoida:** Har qanday “saqlash” faqat API orqali. `localStorage` faqat JWT/session cache + i18n/theme — **biznes entity emas**.

---

## 5. Bosqich 2 doirasi (tasdiqlangach bajariladi)

### 5.1 Majburiy — “bitta baza” kafolati

1. Production/APK buildda **demo o‘chiq**:
   - `demoStore` merge yo‘q
   - `DEMO_JOBS` fallback yo‘q
   - `qulay_ish_demo_session` ignore
   - AI mock faqat aniq `VITE_AI_MOCK_MODE=true` da (default production = false)
2. `VITE_API_URL=https://mexrliqollar.uz/api` (yoki env bo‘yicha staging)
3. Upload/media URL lar absolute host bilan ishlashi

### 5.2 Capacitor shell

1. `@capacitor/core`, `@capacitor/cli`, `@capacitor/android`
2. `capacitor.config.ts` — `webDir: dist`, `server.androidScheme: https` (yoki mos sozlama)
3. `npm run build` → `npx cap sync android`
4. Android project: `android/` (gitga qo‘shiladi yoki build artifact sifatida hujjatlanadi)
5. Deep link / routing: Capacitor uchun `BrowserRouter` basename yoki `HashRouter` / `server.url` strategiyasi
6. Splash / status bar / back button — minimal native polish
7. Debug APK + (imkon bo‘lsa) release unsigned/signed yo‘riqnoma

### 5.3 Backend (kichik)

1. `CORS_ORIGIN` ga production web + kerakli Capacitor originlar
2. JWT/upload oqimi o‘zgarishsiz qoladi

### 5.4 Explicitly OUT OF SCOPE (hozircha)

- React Native / Expo rewrite
- WebSocket chat
- Payme/Click real gateway
- Offline-first sync engine
- Push notification (FCM) — keyingi iteratsiya

---

## 6. Muvaffaqiyat mezonlari

| # | Mezon | Tekshiruv |
|---|--------|-----------|
| 1 | APK dan register/login | Yozuv PostgreSQL da, saytda ko‘rinadi |
| 2 | Saytdan ish yaratish | APK `/jobs` da ko‘rinadi |
| 3 | APK dan ariza | Sayt employer panelida ko‘rinadi |
| 4 | Demo job/user yo‘q | Network tabda faqat `/api/*` |
| 5 | Token | `Authorization: Bearer` → `/api/auth/me` 200 |
| 6 | Bir xil rol UI | worker/employer oqimlari ishlaydi |

---

## 7. Risklar va mitigatsiya

| Risk | Mitigatsiya |
|------|-------------|
| WebView da nisbiy `/api` sinadi | Absolute `VITE_API_URL` |
| Deep link 404 | HashRouter yoki Android intent + SPA fallback |
| Demo data “yopishib” qoladi | `import.meta.env.PROD` / `VITE_DISABLE_DEMO=true` gate |
| CORS | nginx + Nest `CORS_ORIGIN` yangilash |
| Katta admin UI WebView da sekin | Avval asosiy user oqimlari; keyin optimizatsiya |

---

## 8. Qaror bayonnomasi

```
ADOPT: Capacitor (Variant A) over existing Vite React SPA
REJECT (hozircha): Expo/RN to‘liq rewrite
KEEP: NestJS + Prisma + PostgreSQL as single source of truth
REQUIRE: Strip demo/mock before shipping APK
EVOLVE: Expo/native modules later if push/offline demand it
```

---

## Holat

**Bosqich 2–8 amalga oshirildi** (2026-08-08): Capacitor Android loyihasi, demo/mock olib tashlandi, HTTPS-only, Preferences token, offline banner, debug/release APK build scriptlari.  
Yo‘riqnoma: [`MOBILE.md`](./MOBILE.md).
