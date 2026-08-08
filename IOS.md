# mexrliqollar.uz — iOS (Capacitor)

Android APK bilan **bir xil** React SPA + NestJS API (`https://mexrliqollar.uz/api`).

| | |
|--|--|
| Bundle ID | `uz.mexrliqollar.app` |
| Display name | `mexrliqollar.uz` |
| Platform papka | `ios/` |
| Min iOS | 15.0 |
| API | `.env.capacitor` → `VITE_API_URL=https://mexrliqollar.uz/api` |

## Muhim cheklov

**IPA yig‘ish faqat macOS + Xcode** da mumkin. Kali/Linux da loyiha sync bo‘ladi, lekin `.ipa` chiqmaydi.

## Kali / Linux (loyiha tayyorlash)

```bash
cd ~/Desktop/qulay_ish
git pull origin main
chmod +x scripts/build-ios.sh
./scripts/build-ios.sh sync
```

Natija: yangilangan `ios/` (web `dist` + pluginlar). Mac ga clone/pull qiling.

## macOS (simulator / iPhone)

Talablar: Xcode 16+, Apple ID (free) yoki Apple Developer Program (TestFlight/App Store).

```bash
cd ~/Desktop/qulay_ish   # yoki Mac dagi clone
git pull origin main
npm install
./scripts/build-ios.sh open
```

Xcode da:
1. Target **App** → **Signing & Capabilities** → Team
2. Simulator yoki ulangan iPhone → **Run**
3. Archive: Product → Archive → Distribute (yoki `./scripts/build-ios.sh archive`)

IPA export uchun:

```bash
cp ios/ExportOptions.plist.example ios/ExportOptions.plist
# teamID ni Apple Team ID ga almashtiring
./scripts/build-ios.sh archive
# → artifacts/mexrliqollar-ios-latest.ipa (ExportOptions bo'lsa)
```

## npm skriptlar

```bash
npm run build:ios     # vite capacitor + cap sync ios
npm run cap:sync:ios
npm run cap:open:ios  # faqat macOS
```

## Tarmoq / CORS

- `capacitor.config.ts`: `iosScheme: 'https'`, `hostname: 'mexrliqollar.uz'`, `CapacitorHttp.enabled`
- Nest CORS Capacitor originlarni merge qiladi (`api/src/main.ts`)
- Info.plist: kamera/galereya (verification), ATS HTTPS-only

## Sayt ↔ iOS sinxron

1. iOS da register/login → PostgreSQL da yozuv
2. https://mexrliqollar.uz da shu user ko‘rinadi
3. Network: faqat `https://mexrliqollar.uz/api/*`
