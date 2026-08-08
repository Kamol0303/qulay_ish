#!/usr/bin/env bash
# Build Capacitor Android APK against production API (ishliayol.uz).
set -euo pipefail
ROOT="$(cd "$(dirname "$0")/.." && pwd)"
cd "$ROOT"

export ANDROID_HOME="${ANDROID_HOME:-/opt/android-sdk}"
export PATH="$ANDROID_HOME/cmdline-tools/latest/bin:$ANDROID_HOME/platform-tools:$PATH"

MODE="${1:-debug}" # debug | release

echo "==> Vite build (mode=capacitor, API=https://ishliayol.uz/api)"
npm run build -- --mode capacitor

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
  (cd android && ./gradlew assembleRelease)
  APK="$ROOT/android/app/build/outputs/apk/release/app-release.apk"
else
  echo "==> assembleDebug"
  (cd android && ./gradlew assembleDebug)
  APK="$ROOT/android/app/build/outputs/apk/debug/app-debug.apk"
fi

OUT_DIR="${APK_OUT:-/opt/cursor/artifacts}"
mkdir -p "$OUT_DIR"
STAMP=$(date +%Y%m%d-%H%M%S)
DEST="$OUT_DIR/ishliayol-${MODE}-${STAMP}.apk"
cp -f "$APK" "$DEST"
cp -f "$APK" "$OUT_DIR/ishliayol-${MODE}-latest.apk"
echo "APK ready: $DEST"
ls -lh "$DEST"
