#!/usr/bin/env bash
# Build Capacitor Android APK against production API (ishliayol.uz).
set -euo pipefail
ROOT="$(cd "$(dirname "$0")/.." && pwd)"
cd "$ROOT"

MODE="${1:-debug}" # debug | release

# --- JDK: Android Gradle needs a FULL JDK with javac (not JRE / broken Java 25 on Kali) ---
pick_java_home() {
  if [[ -n "${JAVA_HOME:-}" && -x "${JAVA_HOME}/bin/javac" ]]; then
    echo "$JAVA_HOME"
    return 0
  fi
  local candidate
  for candidate in \
    /usr/lib/jvm/java-21-openjdk-amd64 \
    /usr/lib/jvm/java-17-openjdk-amd64 \
    /usr/lib/jvm/java-21-openjdk \
    /usr/lib/jvm/java-17-openjdk \
    /usr/lib/jvm/temurin-21-jdk-amd64 \
    /usr/lib/jvm/temurin-17-jdk-amd64
  do
    if [[ -x "$candidate/bin/javac" ]]; then
      echo "$candidate"
      return 0
    fi
  done
  # Fallback: dirname of real javac on PATH (skip broken java-25 JRE)
  if command -v javac >/dev/null 2>&1; then
    local javac_path jhome
    javac_path="$(readlink -f "$(command -v javac)")"
    jhome="$(dirname "$(dirname "$javac_path")")"
    if [[ -x "$jhome/bin/javac" ]] && [[ "$jhome" != *java-25* ]]; then
      echo "$jhome"
      return 0
    fi
  fi
  return 1
}

if ! JAVA_HOME_RESOLVED="$(pick_java_home)"; then
  cat <<'EOF'
ERROR: To'liq JDK topilmadi (javac yo'q).

Kali/Debian da Java 25 ba'zan compiler'siz keladi va Gradle shunday xato beradi:
  Toolchain ... java-25-openjdk ... does not provide ... [JAVA_COMPILER]

Yechim (JDK 21 tavsiya):
  sudo apt update
  sudo apt install -y openjdk-21-jdk
  export JAVA_HOME=/usr/lib/jvm/java-21-openjdk-amd64
  export PATH="$JAVA_HOME/bin:$PATH"
  java -version
  javac -version

Keyin qayta:
  cd ~/Desktop/qulay_ish
  ./scripts/build-apk.sh debug
EOF
  exit 1
fi

export JAVA_HOME="$JAVA_HOME_RESOLVED"
export PATH="$JAVA_HOME/bin:$PATH"
echo "==> JAVA_HOME=$JAVA_HOME"
java -version
javac -version

export ANDROID_HOME="${ANDROID_HOME:-${HOME}/Android/Sdk}"
if [[ ! -d "$ANDROID_HOME" && -d /opt/android-sdk ]]; then
  export ANDROID_HOME=/opt/android-sdk
fi
export PATH="$ANDROID_HOME/cmdline-tools/latest/bin:$ANDROID_HOME/platform-tools:$PATH"

if [[ ! -d "$ANDROID_HOME" ]]; then
  cat <<EOF
ERROR: Android SDK topilmadi (ANDROID_HOME=$ANDROID_HOME).

O'rnating yoki yo'lni belgilang:
  export ANDROID_HOME=\$HOME/Android/Sdk
EOF
  exit 1
fi

# APK chiqish papkasi — root kerak emas
OUT_DIR="${APK_OUT:-$ROOT/artifacts}"
mkdir -p "$OUT_DIR"

# Pull'dan keyin yangi paketlar (masalan @capacitor/haptics) o'rnatilmagan bo'lishi mumkin
echo "==> npm install (frontend deps)"
npm install --no-fund --no-audit

# Belt-and-suspenders: even if .env.capacitor missing, bake production API
export VITE_API_URL="${VITE_API_URL:-https://ishliayol.uz/api}"
export VITE_APP_URL="${VITE_APP_URL:-https://ishliayol.uz}"
export VITE_AI_MOCK_MODE="${VITE_AI_MOCK_MODE:-false}"
export VITE_USE_EMULATOR="${VITE_USE_EMULATOR:-false}"

echo "==> Vite build (mode=capacitor, API=$VITE_API_URL)"
npm run build -- --mode capacitor

# Guard: APK must never ship relative /api-only bundles
JS_BUNDLE="$(ls dist/assets/index-*.js 2>/dev/null | head -1 || true)"
if [[ -z "$JS_BUNDLE" ]] || ! grep -q 'https://ishliayol.uz/api' "$JS_BUNDLE"; then
  echo "ERROR: dist ichida https://ishliayol.uz/api topilmadi. APK relative /api bilan ishlamaydi."
  exit 1
fi
echo "==> API URL baked OK ($(grep -o 'https://ishliayol.uz/api' "$JS_BUNDLE" | wc -l) hits)"

echo "==> Capacitor sync android"
npx cap sync android

if [[ "$MODE" == "release" ]]; then
  KEYSTORE="${RELEASE_KEYSTORE:-$ROOT/android/release.keystore}"
  if [[ ! -f "$KEYSTORE" ]]; then
    echo "==> Generating local release keystore (NOT for Play Store reuse): $KEYSTORE"
    keytool -genkeypair -v \
      -keystore "$KEYSTORE" \
      -alias ishliayol \
      -keyalg RSA -keysize 2048 -validity 10000 \
      -storepass "${RELEASE_STORE_PASSWORD:-ishliayol_release}" \
      -keypass "${RELEASE_KEY_PASSWORD:-ishliayol_release}" \
      -dname "CN=ishliayol.uz, OU=Mobile, O=ishliayol, L=Samarkand, ST=Samarkand, C=UZ"
  fi
  cat > "$ROOT/android/key.properties" <<EOF
storeFile=$KEYSTORE
storePassword=${RELEASE_STORE_PASSWORD:-ishliayol_release}
keyAlias=ishliayol
keyPassword=${RELEASE_KEY_PASSWORD:-ishliayol_release}
EOF
  echo "==> assembleRelease"
  (cd android && ./gradlew assembleRelease -Dorg.gradle.java.home="$JAVA_HOME")
  APK="$ROOT/android/app/build/outputs/apk/release/app-release.apk"
else
  echo "==> assembleDebug"
  (cd android && ./gradlew assembleDebug -Dorg.gradle.java.home="$JAVA_HOME")
  APK="$ROOT/android/app/build/outputs/apk/debug/app-debug.apk"
fi

STAMP=$(date +%Y%m%d-%H%M%S)
DEST="$OUT_DIR/ishliayol-${MODE}-${STAMP}.apk"
cp -f "$APK" "$DEST"
cp -f "$APK" "$OUT_DIR/ishliayol-${MODE}-latest.apk"
echo "APK ready: $DEST"
ls -lh "$DEST"
echo "Also: $OUT_DIR/ishliayol-${MODE}-latest.apk"
