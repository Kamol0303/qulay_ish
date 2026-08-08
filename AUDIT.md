# AUDIT.md — Bosqich 0: To‘liq kod bazasi auditi

**Loyiha:** `Kamol0303/qulay_ish` (ishliayol.uz)  
**Audit sanasi:** 2026-08-08  
**Maqsad:** Veb-sayt bilan **bir xil NestJS API + PostgreSQL** ustida ishlaydigan production Android `.apk` uchun arxitektura qarori asosi.  
**Usul:** Faqat mavjud kod o‘qildi; taxmin qilinmadi. Yangi funksiya kodi yozilmadi.

> **Muhim xulosa (qisqa):** Loyiha **API-based** (Vite React SPA + NestJS REST + Prisma/PostgreSQL). Alohida mobil shell yo‘q. Asosiy CRUD API mavjud. Frontendda **demo/mock/localStorage** qatlamlari bor — ular “bitta backend” talabini buzadi va APK oldidan o‘chirilishi/bloklanishi shart.

---

## 1. Frontend stack

| Band | Holat |
|------|--------|
| Framework | **React 19.2** + **TypeScript ~5.8** (SPA, Next.js emas) |
| Entry | `index.html` → `src/main.tsx` → `src/App.tsx` |
| Routing | `react-router-dom` v7 — `BrowserRouter` + `Routes` / `ProtectedRoute` / `RoleProtectedRoute` |
| Build | **Vite 6** (`vite.config.ts`), pluginlar: `@vitejs/plugin-react`, `@tailwindcss/vite` |
| Dev server | Port **3000**, proxy: `/api` va `/uploads` → `http://localhost:4000` |
| State | React Context: `AuthContext`, `ThemeContext`. **Redux/Zustand yo‘q** |
| API client | `fetch` — `src/lib/api/client.ts` + facade `src/lib/api/index.ts` |
| Base URL | `VITE_API_URL` yoki default `/api` |
| Auth header | `Authorization: Bearer <token>` |
| Token storage | `localStorage`: `qulay_ish_access_token`, `qulay_ish_session_profile` |
| Mobil | **Capacitor / React Native / android/ — yo‘q** |

**Paket:** root `package.json` (`name: react-example`).

---

## 2. Backend stack

| Band | Holat |
|------|--------|
| Joylashuv | Monorepo ichida: `/api` (alohida Nest loyiha) |
| Framework | **NestJS 11** (`qulay-ish-api`) |
| ORM | **Prisma 6** |
| DB | **PostgreSQL** (`DATABASE_URL`) |
| Global prefix | `/api` (`api/src/main.ts`) |
| Port | `API_PORT` yoki **4000** |
| Arxitektura | **API-based** (SSR monolit emas). Frontend alohida Vite build → nginx `dist/` |
| Modullar | `AuthModule`, `ResourcesModule`, `UploadsModule`, `VerificationModule`, `PrismaModule`, `ConfigModule` |
| Production proxy | `nginx-config.conf`: `https://ishliayol.uz` → `/api/` → `127.0.0.1:4000` |

**Xulosa qaror daraxti uchun:** To‘liq REST API **mavjud** (GraphQL yo‘q). Server-rendered monolit emas.

---

## 3. Ma’lumotlar bazasi

**Fayl:** `api/prisma/schema.prisma`

### Enumlar
`UserRole`, `VerificationStatus`, `JobStatus`, `ApplicationStatus`, `ContractStatus`, `DisputeStatus`, `NotificationType`, `ServicePostStatus`, `PaymentStatus`, `LogType`

### Rollar (`UserRole`)
`worker` | `employer` | `admin` | `super_admin`

### Modellar (20)
`User`, `Job`, `Application`, `Contract`, `Dispute`, `ServicePost`, `ChatMessage`, `Notification`, `VerificationRequest`, `Review`, `SavedJob`, `Payment`, `Violation`, `ActivityLog`, `SystemLog`, `GlobalSettings`, `SystemStats`, `OtpSession`, `OtpPhoneLock`, `RefreshToken`

> `RefreshToken` model mavjud, lekin `api/src` da refresh/logout endpointlari **ishlatilmaydi**.

### Qisqa ER

```
User (hub)
 ├─ Job (employerId)
 │   ├─ Application
 │   ├─ Contract?
 │   └─ SavedJob
 ├─ Application (worker / employer)
 ├─ Contract (worker / employer) ─ Dispute
 ├─ ServicePost
 ├─ ChatMessage (sender / receiver)
 ├─ Notification
 ├─ VerificationRequest
 ├─ Review
 ├─ Payment / Violation / ActivityLog
 └─ OtpSession / RefreshToken (schema)
GlobalSettings, SystemStats, SystemLog — platforma
```

---

## 4. Mavjud API endpointlar

**Prefix:** `/api`  
**Format:** JSON (`Content-Type: application/json`); upload — `multipart/form-data`.  
**Auth javobi:** `{ accessToken, user }` (JWT).

### Auth (`auth.controller.ts`)

| Method | Path | Auth | Izoh |
|--------|------|------|------|
| POST | `/api/auth/send-otp` | Yo‘q | purpose: `login` \| `register` \| `reset` |
| POST | `/api/auth/verify-otp` | Yo‘q | register→user yaratadi + JWT; reset→parol o‘zgartirishga ruxsat |
| POST | `/api/auth/login` | Yo‘q | telefon/email + parol → JWT |
| POST | `/api/auth/super-admin/login` | Yo‘q | `api/.env` SUPER_ADMIN_* |
| POST | `/api/auth/register` | Yo‘q | **O‘chirilgan** (400) — faqat OTP register |
| POST | `/api/auth/reset-password` | Yo‘q | reset OTP dan keyin |
| GET | `/api/auth/me` | JWT | joriy profil |

### Uploads

| Method | Path | Auth | Izoh |
|--------|------|------|------|
| POST | `/api/uploads` | JWT | public yoki private (verification) |
| GET | `/api/uploads/private/:userId/:filename` | JWT | egasi yoki super_admin |
| DELETE | `/api/uploads/:filename` | JWT | o‘z fayli |

Static: `/uploads/public/...` (ochiq); `/uploads/private` to‘g‘ridan-to‘g‘ri **403**.

### Verification

| Method | Path | Auth |
|--------|------|------|
| GET | `/api/verification-requests` | JWT |
| GET | `/api/verification-requests/mine` | JWT |
| POST | `/api/verification-requests` | JWT |
| PATCH | `/api/verification-requests/:id` | JWT (user resubmit / super_admin review) |
| POST | `/api/verification-requests/bulk` | JWT + `super_admin` |

### Resources (asosiy CRUD)

| Resurs | GET list | GET one | POST | PATCH | DELETE |
|--------|----------|---------|------|-------|--------|
| `/users` | ✓ (public) | ✓ (public) | — | ✓ JWT | — |
| `/users/:id/personal-info` | ✓ JWT | — | — | PUT JWT | — |
| `/users/:id/core-indicators` | ✓ JWT | — | — | PUT super_admin | — |
| `/jobs` | ✓ public | ✓ public | ✓ JWT (verified) | ✓ JWT | — |
| `/applications` | ✓ JWT | ✓ JWT | ✓ JWT (verified) | ✓ JWT | — |
| `/contracts` | ✓ JWT | ✓ JWT | ✓ JWT (+ from-application) | ✓ JWT | — |
| `/notifications` | ✓ JWT | — | ✓ JWT | ✓ JWT | — |
| `/chat-messages` | ✓ JWT (+ `/inbox`) | — | ✓ JWT | ✓ JWT | — |
| `/disputes` | ✓ **public** | — | ✓ JWT | ✓ JWT | — |
| `/reviews` | ✓ public | — | ✓ JWT | — | — |
| `/saved-jobs` | ✓ JWT | — | ✓ JWT | — | POST `/delete` |
| `/service-posts` | ✓ public | — | ✓ JWT | ✓ JWT | — |
| `/payments` | ✓ **public** | — | ✓ JWT (stub) | ✓ JWT | — |
| `/violations` | — | — | ✓ JWT | — | — |
| `/activity-logs` | ✓ admin+ | — | ✓ JWT | — | — |
| `/system-logs` | ✓ admin+ | — | ✓ JWT | — | — |
| `/settings/global` | ✓ admin+ | — | — | ✓ super_admin | — |
| `/stats/counts` | ✓ public | — | — | — | — |

**API yo‘q emas** — asosiy marketplace oqimlari qoplangan. Bo‘shliqlar: hard DELETE (ko‘p resurslarda yo‘q), to‘lov gateway yo‘q, WebSocket yo‘q, refresh-token API yo‘q.

---

## 5. Autentifikatsiya

| Band | Holat |
|------|--------|
| Mexanizm | **JWT Bearer** (cookie session emas) |
| Guard | `JwtAuthGuard` + `RolesGuard` / `@Roles(...)` |
| Parol hash | **bcryptjs** (cost 10) |
| JWT muddati | `JWT_EXPIRES_IN` default **30d** |
| Secret | `JWT_SECRET` (prod majburiy) |
| OTP | DevSMS; kod bcrypt hash; TTL 5 daq; max 5 urinish; 60s/telefon |
| Register | SMS OTP majburiy (`send-otp` → `verify-otp`) |
| Login | Telefon/email + parol (`/auth/login`) |
| Forgot password | OTP `reset` → `/auth/reset-password` |
| Super Admin | Alohida `/auth/super-admin/login` + env credentials |
| RBAC | Ha — `worker`, `employer`, `admin`, `super_admin` |
| Refresh | Schema bor, API yo‘q |

---

## 6. Sahifalar xaritasi

Manba: `src/App.tsx`.

### Ommaviy
| Route | Vazifa | CRUD / ma’lumot |
|-------|--------|-----------------|
| `/` | Landing | Stats (`/stats/counts`), marketing |
| `/auth` | Login / register / reset | Auth OTP + password API |
| `/super-admin-login` | Super admin kirish | `/auth/super-admin/login` |
| `/jobs` | Ishlar ro‘yxati | GET jobs (+ **DEMO merge** xavfi) |
| `/workers` | Ishchilar / video | Users API + **statik YouTube** |
| `/worker/:userId` | Ommaviy profil | GET user, reviews, core-indicators |
| `/statistics` | Statistika | API + charts |
| `/courses` | Kurslar | **To‘liq statik** (API yo‘q) |
| `/qulay-ish` | Tavsiya / AI ishlar | Jobs API + **client-side scoring** |
| `/qulay-ish/job/:jobId` | Tavsiya ish detali | Job GET |
| `/saved-jobs` | Saqlangan | saved-jobs API |
| `/403` | Forbidden | — |

### Himoyalangan (JWT)
| Route | Rol | Vazifa |
|-------|-----|--------|
| `/my-profile` | any | Profil CRUD |
| `/chat` | any | Chat (poll) |
| `/notifications` | any | Bildirishnomalar |
| `/contracts/:contractId` | party/staff | Shartnoma |
| `/verification` | any | Passport/selfie verification |
| `/resume/:userId` | any | Resume ko‘rish/PDF |

### Worker
`/worker/dashboard`, `/applications`, `/contracts`, `/service-posts`, `/create-service`, `/edit-service/:postId`

### Employer
`/employer/dashboard`, `/jobs`, `/jobs/:jobId`, `/create-job`, `/applicants`, `/contracts`, `/create-contract`, `/worker-services`

### Admin / Super Admin
`/admin/*`, `/super-admin/*` — users, jobs, verification, disputes, contracts, logs, settings, analytics, applications, messages, notifications

---

## 7. UI dizayn tizimi

| Band | Holat |
|------|--------|
| CSS | **Tailwind CSS v4** (`@tailwindcss/vite`, `src/index.css` `@theme`) |
| Font | **Plus Jakarta Sans** (sans), **IBM Plex Sans** (mono) — Google Fonts |
| Primary | HSL ~`217 91% 60%` (ko‘k); theme forced **light** |
| Radius | `--radius: 1rem` |
| Ikonlar | `lucide-react` |
| Animatsiya | `motion` |
| Chart | `recharts` |
| i18n | `i18next` — `uz` (default), `ru`, `en` (`src/locales/`) |
| RTL | Yo‘q |
| Breakpointlar | Tailwind default: `sm` 640, `md` 768, `lg` 1024, `xl` 1280 |
| Responsive | Sahifalarda `sm:`/`md:`/`lg:` keng ishlatiladi |

---

## 8. Tashqi integratsiyalar

| Integratsiya | Holat |
|--------------|--------|
| **DevSMS** | Ha — OTP (`DEVSMS_TOKEN`, `DEVSMS_BASE_URL`) |
| **Fayl saqlash** | **Lokal disk** `uploads/public` + `uploads/private` (S3 yo‘q) |
| **To‘lov** | Payme/Click/Uzum — **faqat tip/stub**; API faqat `Payment` jadval CRUD |
| **Telegram bot** | Yo‘q (profil maydoni `telegram` bor) |
| **Xarita** | Yo‘q |
| **AI** | Frontend `MockAIProvider` / `VITE_AI_MOCK_MODE`; OpenAI yo‘li kommentda |
| **Firebase** | `functions/`, `salom/` papkalari bor — **asosiy React frontend ulanmagan** |
| CDN/media | ui-avatars, Unsplash, YouTube, Wikimedia (marketing) |

---

## 9. Real-time funksiyalar

| Band | Holat |
|------|--------|
| WebSocket | **Yo‘q** |
| SSE | **Yo‘q** |
| Chat / notifications | **HTTP polling** (`setInterval` 5–15s) |
| Nest gateway | **Yo‘q** |

---

## 10. Xavfsizlik holati

| Band | Holat |
|------|--------|
| HTTPS | Nest HTTP; TLS **nginx + Let’s Encrypt** (`nginx-config.conf`, ishliayol.uz) |
| CORS | `CORS_ORIGIN` CSV; default localhost:3000 + ishliayol.uz; `credentials: true` |
| Rate limit | Faqat OTP (60s/telefon). Global throttler **yo‘q** |
| Validation | Global `ValidationPipe` (whitelist, forbidNonWhitelisted) |
| Headers | `X-Content-Type-Options`, `X-Frame-Options`, `Referrer-Policy` |
| Secrets | `api/.env` — `DATABASE_URL`, `JWT_SECRET`, `SUPER_ADMIN_*`, `DEVSMS_*` (repo ga commit qilinmasligi kerak) |
| Private files | JWT orqali; static private path 403 |
| Zaif joylar | Ba’zi GET public (`/payments`, `/disputes`); ba’zi PATCH ownership zaif; JWT 30d refresh yo‘q; demo session JWT’siz |

---

## Qo‘shimcha: “Bitta backend” talabiga xavf (majburiy e’tibor)

Quyidagilar **alohida/nusxa/lokal** ma’lumot yaratadi yoki API ni yashiradi — APK/production oldidan bartaraf etilishi shart:

| Manba | Muammo |
|-------|--------|
| `src/constants/demoData.ts` | Hardcoded `DEMO_JOBS` |
| `src/lib/demoStore.ts` | localStorage merge (users/jobs/contracts) — lokal “g‘olib” bo‘lishi mumkin |
| `src/lib/demoAuth.ts` | Demo auth (hozir import qilinmasa ham mavjud) |
| `AuthContext` + `qulay_ish_demo_session` | JWT’siz demo sessiya |
| `JobsPage` / admin jobs | DEMO_JOBS merge / API error fallback |
| `CoursesPage` | 100% lokal massiv |
| `ChatAssistant` | Hardcoded javoblar |
| `aiAssistantService` | Mock AI |
| `monetizationService.recordCommission` | No-op stub |

**Talabga muvofiqlik qoidasi:** APK va sayt faqat `VITE_API_URL` → Nest → PostgreSQL. Mock/demo localStorage production buildda o‘chiq bo‘lishi kerak.

---

## APK uchun texnik oqibatlar (fakt, hali qaror emas)

1. Backend **tayyor REST** — mobil client ulanishi mumkin (`Authorization: Bearer`).
2. Hozirgi `VITE_API_URL=/api` WebView da ishlamaydi — **absolute** URL kerak (`https://ishliayol.uz/api`).
3. `BrowserRouter` deep-link uchun Capacitor/server fallback yoki `HashRouter` kerak.
4. Demo/mock qatlamni o‘chirmasdan “bitta baza” kafolatlanmaydi.
5. Chat real-time emas — polling qoladi yoki keyin WebSocket qo‘shiladi.
6. Courses va ba’zi marketing kontent API’siz — APK da ham statik qoladi (yoki keyin CMS/API).

---

## Bosqich 0 yakuni

| # | Savol | Javob |
|---|-------|-------|
| 1 | Frontend | React 19 + Vite 6 + RRD7 + Tailwind4 + Context |
| 2 | Backend | NestJS 11 API (`/api`), monorepo `/api` |
| 3 | DB | PostgreSQL + Prisma, 20 model |
| 4 | API | **Mavjud** — to‘liq ro‘yxat yuqorida |
| 5 | Auth | JWT + bcrypt + OTP SMS + RBAC |
| 6 | Sahifalar | Landing → worker/employer/admin/super-admin |
| 7 | UI | Tailwind, Plus Jakarta, i18n uz/ru/en |
| 8 | Integratsiyalar | DevSMS, local uploads; to‘lov/xarita/Telegram bot yo‘q |
| 9 | Real-time | Yo‘q (polling) |
| 10 | Xavfsizlik | nginx HTTPS; CORS; OTP limit; demo/mock xavfi |

---

## Keyingi qadam

**Bosqich 1** (ARCHITECTURE_DECISION.md) — auditga asosan yo‘l tanlash:

- Qaror daraxti bo‘yicha: **to‘liq REST API mavjud** → rasmiy tavsiya **React Native (Expo)**.
- Shu bilan birga sizning “standart tavsiya Variant A (Capacitor)” yo‘lingiz ham mavjud: mavjud SPA ni shell ga o‘rash — UI/CRUD pariteti eng tez, lekin bu daraxtning “API yo‘q → monolit” tarmog‘ida yozilgan.

**Men Bosqich 1 ga o‘tmayman.**  
Iltimos, shu `AUDIT.md` ni tasdiqlang (yoki tuzatish so‘rang) — keyin arxitektura qarorini yozaman.
