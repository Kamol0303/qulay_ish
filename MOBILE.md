# ishliayol.uz — Android APK (Capacitor)

Web va APK **bir xil NestJS API + PostgreSQL** (`https://ishliayol.uz/api`) bilan ishlaydi.  
Demo/local-only ma’lumot o‘chirilgan.

## Talablar

- Node 20+
- **JDK 17 yoki 21** (to‘liq `*-jdk`, faqat JRE emas — `javac` bo‘lishi shart)
- Android SDK (`ANDROID_HOME`, platform 35+)
- Backend ishlayotgan bo‘lishi shart (production yoki local API)

### Kali Linux: Android SDK yo‘q

```bash
sudo apt update
sudo apt install -y openjdk-21-jdk unzip curl wget

cd ~/Desktop/qulay_ish
chmod +x scripts/setup-android-sdk.sh scripts/build-apk.sh
./scripts/setup-android-sdk.sh

export JAVA_HOME=/usr/lib/jvm/java-21-openjdk-amd64
export ANDROID_HOME=$HOME/Android/Sdk
export PATH="$JAVA_HOME/bin:$ANDROID_HOME/cmdline-tools/latest/bin:$ANDROID_HOME/platform-tools:$PATH"

./scripts/build-apk.sh release
ls -lh artifacts/ishliayol-release-latest.apk
```

APK ni Telegram / Google Drive orqali ulashing (GitHub `gh` shart emas).

### Kali Linux: `JAVA_COMPILER` / Java 25 xatosi

Agar shunday xato chiqsa:

```text
Toolchain installation '.../java-25-openjdk-amd64' does not provide the required capabilities: [JAVA_COMPILER]
```

Java 25 da ba’zan `javac` yo‘q. **JDK 21** o‘rnating:

```bash
sudo apt update
sudo apt install -y openjdk-21-jdk
export JAVA_HOME=/usr/lib/jvm/java-21-openjdk-amd64
export PATH="$JAVA_HOME/bin:$PATH"
java -version    # 21 bo‘lishi kerak
javac -version   # majburiy — ishlashi kerak

cd ~/Desktop/qulay_ish
./scripts/build-apk.sh debug
```

Doimiy qilish uchun `~/.zshrc` yoki `~/.bashrc` ga qo‘shing:

```bash
export JAVA_HOME=/usr/lib/jvm/java-21-openjdk-amd64
export PATH="$JAVA_HOME/bin:$PATH"
```

## Tezkor build

Repo **ildizidan** (yoki `scripts/` dan ham ishlaydi):

```bash
cd ~/Desktop/qulay_ish

# Debug APK
./scripts/build-apk.sh debug

# Imzolangan release APK (local keystore avtomatik yaratiladi — Play Store uchun alohida saqlang)
./scripts/build-apk.sh release
```

APK chiqishi: `artifacts/ishliayol-*-latest.apk` (yoki `APK_OUT=...`).

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
