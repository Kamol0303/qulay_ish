#!/usr/bin/env bash
# deploy_firebase.sh
# Bir qator buyruqlar: .env lokalni tayyorlash, build va firebase deploy

set -euo pipefail

USAGE="Usage: ./scripts/deploy_firebase.sh <PROJECT_ID> [PATH_TO_ENV_LOCAL]
Example: ./scripts/deploy_firebase.sh my-firebase-project ./envs/.env.production.local"

if [ "$#" -lt 1 ]; then
  echo "$USAGE"
  exit 1
fi

PROJECT_ID="$1"
ENV_PATH="${2:-.env.local}"

echo "Project: $PROJECT_ID"
echo "Env file: $ENV_PATH"

if [ ! -f "$ENV_PATH" ]; then
  echo "Env file $ENV_PATH topilmadi. Iltimos .env.local faylini tayyorlang yoki ikkinchi argument sifatida to‘liq yo‘lni bering."
  exit 2
fi

echo "1) O‘rnatish..."
npm install

echo "2) Tozalash va build..."
npm run clean || true
npm run build

echo "3) Firebase CLI login — brauzerda autentifikatsiya qilishingiz kerak bo‘ladi."
if ! command -v firebase >/dev/null 2>&1; then
  echo "firebase CLI topilmadi — global o‘rnatishni taklif qilaman: npm install -g firebase-tools"
  echo "Yoki npx orqali login qilishingiz mumkin: npx firebase login"
  read -p "Davom etilsinmi? (y/n): " yn
  if [ "$yn" != "y" ]; then
    echo "Bekor qilindi."; exit 0
  fi
fi

firebase login || (echo "Login bajarilmadi. Brauzerni tekshiring."; exit 3)

echo "4) Loyihani tanlash yoki qo‘shish (CLI so‘rovi chiqadi)."
firebase use --project "$PROJECT_ID" || firebase use --add

echo "5) Firebase deploy (hosting) — dist katalogi yuboriladi"
firebase deploy --only hosting --project "$PROJECT_ID"

echo "Deploy tugadi. Hosting URLni Firebase CLI chiqishida ko‘rasiz."
