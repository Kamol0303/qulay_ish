#!/usr/bin/env bash
# Kali/Linux: Java 21 + Android SDK PATH
# Ishlatish:  source scripts/env-kali.sh

if [[ -x /usr/lib/jvm/java-21-openjdk-amd64/bin/javac ]]; then
  export JAVA_HOME=/usr/lib/jvm/java-21-openjdk-amd64
elif [[ -x /usr/lib/jvm/java-17-openjdk-amd64/bin/javac ]]; then
  export JAVA_HOME=/usr/lib/jvm/java-17-openjdk-amd64
elif command -v javac >/dev/null 2>&1; then
  export JAVA_HOME="$(dirname "$(dirname "$(readlink -f "$(command -v javac)")")")"
fi

export ANDROID_HOME="${ANDROID_HOME:-$HOME/Android/Sdk}"
if [[ ! -d "$ANDROID_HOME" && -d /opt/android-sdk ]]; then
  export ANDROID_HOME=/opt/android-sdk
fi

export PATH="$JAVA_HOME/bin:$ANDROID_HOME/cmdline-tools/latest/bin:$ANDROID_HOME/platform-tools:$PATH"

echo "JAVA_HOME=$JAVA_HOME"
command -v java >/dev/null && java -version 2>&1 | head -1
command -v javac >/dev/null && echo "javac $(javac -version 2>&1)" || echo "WARNING: javac yo'q — sudo apt install -y openjdk-21-jdk"
echo "ANDROID_HOME=$ANDROID_HOME"
[[ -d "$ANDROID_HOME" ]] || echo "WARNING: SDK yo'q — ./scripts/setup-android-sdk.sh"
