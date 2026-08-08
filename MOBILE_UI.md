# Mobil-native UI (Bosqich 9)

Bitta NestJS `/api` + PostgreSQL. Bu bosqichda faqat presentation o‘zgardi: native APK va `max-width: 768px` brauzerda `MobileShell`, desktopda `DesktopShell` (oldingi Layout/DashboardLayout).

## Qanday yoqiladi

`src/hooks/useIsMobileUi.ts`:

- `Capacitor.isNativePlatform()` → har doim mobil UI
- yoki `matchMedia('(max-width: 768px)')` → telefon brauzeri

`App.tsx` → `AppShell` shu flag bo‘yicha shell tanlaydi. Route pathlar bir xil; faqat ekran komponenti farq qiladi.

## Dizayn tizimi (`src/mobile/`)

| Komponent | Vazifa |
|---|---|
| `shell/MobileShell` | Sticky brand header, safe-area, bottom padding |
| `shell/BottomTabBar` | Rolga qarab 3–5 tab + haptic |
| `shell/DesktopShell` | Passthrough (desktop o‘z layoutida) |
| `components/Card` | Touch card-list |
| `components/BottomSheet` | Pastdan chiqadigan dialog |
| `components/FAB` | Asosiy amal |
| `components/ChipFilter` | Gorizontal filter chip’lar |
| `components/SkeletonCard` | Yuklanish skeleti |
| `components/PullToRefresh` | Ro‘yxatni yangilash |
| `components/SwipeableRow` | Swipe-action |
| `haptics.ts` | `@capacitor/haptics` (faqat native) |

Brend: primary ko‘k, Plus Jakarta Sans, `lucide-react`, `--radius` saqlanadi.

## Pastki tablar

| Rol | Tablar |
|---|---|
| Worker | Bosh · Ishlar · Arizalar · Chat · Profil |
| Employer | Bosh · E’lonlar · Arizalar · Chat · Profil |
| Guest | Bosh · Ishlar · Kirish |
| Admin / Super Admin | Tab yo‘q (9.5) — kontent DesktopLayout-siz MobileShell ichida |

Auth / verification / create-* / contracts da tab yashirin. Auth da yuqori bar ham yashirin.

## Yangi mobil ekranlar

| Route | Ekran |
|---|---|
| `/` | `HomeMobile` (guest); login bo‘lsa dashboardga redirect |
| `/auth` | `AuthMobile` (mavjud AuthPage, to‘liq ekran) |
| `/jobs` | `JobsMobile` — card-list, chip-filter, ariza, FAB |
| `/worker/dashboard` | `WorkerDashboardMobile` |
| `/employer/dashboard` | `EmployerDashboardMobile` |
| `/employer/jobs` | `EmployerJobsMobile` |
| `/worker/applications` | `WorkerApplicationsMobile` |
| `/employer/applicants` (va `/employer/contracts`) | `EmployerApplicationsMobile` |
| `/chat`, `/super-admin/messages` | `ChatMobile` — bubble + inbox |
| `/my-profile` | `ProfileMobile` |
| `/notifications` | `NotificationsMobile` + swipe |
| `/saved-jobs` | `SavedJobsMobile` + swipe-remove |

Ma’lumot: mavjud `api`, `useAuth`, `applicationService`, `jobService`, `contractService` — yangi data path yo‘q.

## Desktop saqlangan / MobileShell ichida

Quyidagilar hali alohida `*Mobile` ekranga ega emas; `DashboardLayout` / `Layout` mobil rejimda sidebar va og‘ir header’ni o‘chiradi (faqat kontent):

- `/verification`, `/contracts/:id`, `/employer/create-job`, create-service/contract
- `/worker/:userId`, `/resume/:userId`, `/workers`, `/courses`, …
- Barcha `/admin/*` va `/super-admin/*` jadvallar (9.5)

## 9.5 (keyingi)

- Admin/Super Admin to‘liq mobil monitoring UI
- Verification / create-job to‘liq step-wizard
- Contract fixed bottom CTA maxsus ekran
- Push (FCM), WebSocket chat

## Tekshiruv

1. DevTools ≤768px yoki APK: pastki tab + card UI
2. Desktop ≥769px: eski navbar/sidebar
3. Network: faqat `/api/*` (demo/mock yo‘q)
4. FAB orqali e’lon / ariza → desktopda ham shu baza orqali ko‘rinadi

## APK

`./scripts/build-apk.sh release` → `artifacts/ishliayol-release-latest.apk`  
(Capacitor/android/build skriptlari Bu bosqichda o‘zgartirilmagan.)
