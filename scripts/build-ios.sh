#!/usr/bin/env bash
# Prepare / build Capacitor iOS app against production API (ishliayol.uz).
# IPA/archive requires macOS + Xcode. On Linux this script syncs the project only.
set -euo pipefail
ROOT="$(cd "$(dirname "$0")/.." && pwd)"
cd "$ROOT"

MODE="${1:-sync}" # sync | open | archive

echo "==> npm install (frontend deps)"
npm install --no-fund --no-audit

export VITE_API_URL="${VITE_API_URL:-https://ishliayol.uz/api}"
export VITE_APP_URL="${VITE_APP_URL:-https://ishliayol.uz}"
export VITE_AI_MOCK_MODE="${VITE_AI_MOCK_MODE:-false}"
export VITE_USE_EMULATOR="${VITE_USE_EMULATOR:-false}"

echo "==> Vite build (mode=capacitor, API=$VITE_API_URL)"
npm run build -- --mode capacitor

JS_BUNDLE="$(ls dist/assets/index-*.js 2>/dev/null | head -1 || true)"
if [[ -z "$JS_BUNDLE" ]] || ! grep -q 'https://ishliayol.uz/api' "$JS_BUNDLE"; then
  echo "ERROR: dist ichida https://ishliayol.uz/api topilmadi."
  exit 1
fi
echo "==> API URL baked OK"

if [[ ! -d ios/App ]]; then
  echo "==> Adding ios platform"
  npx cap add ios
fi

echo "==> Capacitor sync ios"
npx cap sync ios

OUT_DIR="${IOS_OUT:-$ROOT/artifacts}"
mkdir -p "$OUT_DIR"

case "$MODE" in
  sync)
    cat <<EOF
OK: iOS loyiha tayyor (ios/).

Keyingi qadam — macOS + Xcode:
  ./scripts/build-ios.sh open
  # yoki
  npx cap open ios

Xcode: Signing & Capabilities → Team tanlang → Run (simulator/device).
Archive (TestFlight/App Store):
  ./scripts/build-ios.sh archive
EOF
    ;;
  open)
    if [[ "$(uname -s)" != "Darwin" ]]; then
      echo "ERROR: Xcode faqat macOS da ochiladi. Hozir sync qilindi — Mac da 'npx cap open ios' ishlating."
      exit 1
    fi
    npx cap open ios
    ;;
  archive)
    if [[ "$(uname -s)" != "Darwin" ]]; then
      echo "ERROR: IPA/archive faqat macOS + Xcode da yig'iladi."
      echo "Bu Linux/Kali da faqat: ./scripts/build-ios.sh sync"
      exit 1
    fi
    if ! command -v xcodebuild >/dev/null 2>&1; then
      echo "ERROR: xcodebuild topilmadi. Xcode o'rnating."
      exit 1
    fi
    SCHEME="${IOS_SCHEME:-App}"
    WORKSPACE="$ROOT/ios/App/App.xcworkspace"
    PROJECT="$ROOT/ios/App/App.xcodeproj"
    ARCHIVE_PATH="$OUT_DIR/ishliayol-ios.xcarchive"
    EXPORT_PATH="$OUT_DIR/ios-export"
    rm -rf "$ARCHIVE_PATH" "$EXPORT_PATH"
    mkdir -p "$EXPORT_PATH"

    BUILD_TARGET=()
    if [[ -d "$WORKSPACE" ]]; then
      BUILD_TARGET=(-workspace "$WORKSPACE")
    else
      BUILD_TARGET=(-project "$PROJECT")
    fi

    echo "==> xcodebuild archive"
    xcodebuild \
      "${BUILD_TARGET[@]}" \
      -scheme "$SCHEME" \
      -configuration Release \
      -destination 'generic/platform=iOS' \
      -archivePath "$ARCHIVE_PATH" \
      clean archive \
      CODE_SIGN_STYLE=Automatic

    # Optional export if ExportOptions.plist exists
    EXPORT_PLIST="$ROOT/ios/ExportOptions.plist"
    if [[ -f "$EXPORT_PLIST" ]]; then
      echo "==> export IPA"
      xcodebuild -exportArchive \
        -archivePath "$ARCHIVE_PATH" \
        -exportPath "$EXPORT_PATH" \
        -exportOptionsPlist "$EXPORT_PLIST"
      IPA="$(ls "$EXPORT_PATH"/*.ipa 2>/dev/null | head -1 || true)"
      if [[ -n "$IPA" ]]; then
        cp -f "$IPA" "$OUT_DIR/ishliayol-ios-latest.ipa"
        echo "IPA: $OUT_DIR/ishliayol-ios-latest.ipa"
      fi
    else
      echo "Archive: $ARCHIVE_PATH"
      echo "IPA export uchun ios/ExportOptions.plist yarating (Team ID bilan), keyin qayta: ./scripts/build-ios.sh archive"
    fi
    ;;
  *)
    echo "Usage: $0 [sync|open|archive]"
    exit 1
    ;;
esac
