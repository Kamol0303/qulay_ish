# ishliayol.uz — Android APK (Capacitor)

Web va APK **bir xil NestJS API + PostgreSQL** (`https://ishliayol.uz/api`) bilan ishlaydi.  
Demo/local-only ma’lumot o‘chirilgan.

## Talablar

- Node 20+
- JDK 21
- Android SDK (`ANDROID_HOME`, platform 35+)
- Backend ishlayotgan bo‘lishi shart (production yoki local API)

## Tezkor build

```bash
# Debug APK
./scripts/build-apk.sh debug

# Imzolangan release APK (local keystore avtomatik yaratiladi — Play Store uchun alohida saqlang)
./scripts/build-apk.sh release
```

APK chiqishi: `/opt/cursor/artifacts/ishliayol-*-latest.apk` (yoki `APK_OUT=...`).

## Qo‘lda

```bash
npm install
npm run build -- --mode capacitor   # VITE_API_URL=https://ishliayol.uz/api
npx cap sync android
npx cap open android                # Android Studio
# yoki
cd android && ./gradlew assembleDebug
```

## Muhit

| Fayl | Vazifa |
|------|--------|
| `.env.capacitor` | APK build: absolute API URL |
| `capacitor.config.ts` | appId `uz.ishliayol.app`, HTTPS-only, allowNavigation |
| `api/.env` `CORS_ORIGIN` | `https://localhost`, `capacitor://localhost` qo‘shilgan |

## Sinxron tekshiruv

1. APK da login/register → DB da yozuv
2. Saytda (`https://ishliayol.uz`) shu user/job ko‘rinsin
3. Saytda ish yarating → APK `/jobs` da yangilang

## Xavfsizlik

- Cleartext o‘chiq; `network_security_config.xml`
- WebView debug faqat `BuildConfig.DEBUG`
- Release: R8 minify
- Keystore / `key.properties` — **repo ga commit qilinmaydi**

## Variant B (keyinroq)

Expo/RN ga o‘tish mumkin — API kontrakti `AUDIT.md` §4 da. Avval Capacitor bilan paritet saqlanadi.
