#!/usr/bin/env bash
# Install Android command-line SDK into $HOME/Android/Sdk (Kali/Debian/Ubuntu).
set -euo pipefail

SDK_ROOT="${ANDROID_HOME:-$HOME/Android/Sdk}"
CMDTOOLS_URL="${CMDTOOLS_URL:-https://dl.google.com/android/repository/commandlinetools-linux-11076708_latest.zip}"
TMP_ZIP="${TMPDIR:-/tmp}/android-cmdline-tools.zip"

echo "==> Android SDK → $SDK_ROOT"
mkdir -p "$SDK_ROOT/cmdline-tools"

if [[ ! -x "$SDK_ROOT/cmdline-tools/latest/bin/sdkmanager" ]]; then
  echo "==> Downloading command-line tools..."
  curl -fsSL -o "$TMP_ZIP" "$CMDTOOLS_URL"
  rm -rf /tmp/android-cmdline-extract
  mkdir -p /tmp/android-cmdline-extract
  unzip -q "$TMP_ZIP" -d /tmp/android-cmdline-extract
  rm -rf "$SDK_ROOT/cmdline-tools/latest"
  mv /tmp/android-cmdline-extract/cmdline-tools "$SDK_ROOT/cmdline-tools/latest"
fi

export ANDROID_HOME="$SDK_ROOT"
export PATH="$ANDROID_HOME/cmdline-tools/latest/bin:$ANDROID_HOME/platform-tools:$PATH"

echo "==> Accepting licenses..."
yes | sdkmanager --sdk_root="$ANDROID_HOME" --licenses >/tmp/android-sdk-licenses.log 2>&1 || true

echo "==> Installing platform-tools, platforms;android-35, build-tools;35.0.0..."
sdkmanager --sdk_root="$ANDROID_HOME" \
  "platform-tools" \
  "platforms;android-35" \
  "build-tools;35.0.0"

echo ""
echo "OK. Shell ga qo‘shing (yoki ~/.zshrc / ~/.bashrc):"
echo "  export ANDROID_HOME=\"$SDK_ROOT\""
echo "  export PATH=\"\$ANDROID_HOME/cmdline-tools/latest/bin:\$ANDROID_HOME/platform-tools:\$PATH\""
echo ""
echo "Keyin APK:"
echo "  export JAVA_HOME=/usr/lib/jvm/java-21-openjdk-amd64"
echo "  export PATH=\"\$JAVA_HOME/bin:\$PATH\""
echo "  cd ~/Desktop/qulay_ish && ./scripts/build-apk.sh release"
echo ""
echo "APK chiqadi: ~/Desktop/qulay_ish/artifacts/ishliayol-release-latest.apk"
