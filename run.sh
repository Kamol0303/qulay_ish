#!/usr/bin/env bash
#
# Mehrli qoʻllar — bitta kirish nuqtasi (single entrypoint).
# Backend, frontend, Android (APK + AAB) va iOS — hammasini shu bitta fayldan
# ishga tushiring yoki yigʻing.
#
# Ishlatish:
#   ./run.sh                 # = dev: backend + frontend (DB avtomatik) birga ishga tushadi
#   ./run.sh dev             # backend + frontend (dev)
#   ./run.sh backend         # faqat API (dev)
#   ./run.sh frontend        # faqat web (dev)
#   ./run.sh setup           # barcha paketlar + DB + migratsiya (birinchi marta)
#
#   ./run.sh apk             # Android APK (release, imzolangan)
#   ./run.sh apk:debug       # Android APK (debug)
#   ./run.sh aab             # Android App Bundle (.aab, Google Play uchun)
#   ./run.sh android         # apk (release) + aab
#   ./run.sh apk:serve       # artifacts/ ni brauzer orqali yuklab olish uchun ulashish
#   ./run.sh ios             # iOS loyihani tayyorlash (sync)
#   ./run.sh ios:archive     # iOS .xcarchive/.ipa (faqat macOS + Xcode)
#
#   ./run.sh build           # web build + api build + apk + aab + ios(sync)  [bor platformalar]
#   ./run.sh all             # build + macOS boʻlsa ios:archive ham
#
#   ./run.sh deploy          # SERVER: Docker bilan DB + API + web (bitta buyruq)
#   ./run.sh deploy:logs     # Docker loglar
#   ./run.sh deploy:down     # Docker to'xtatish
#
# Natijalar: ./artifacts/ papkasida (APK/AAB/IPA).
#
set -uo pipefail

ROOT="$(cd "$(dirname "$0")" && pwd)"
cd "$ROOT"

bold() { printf '\033[1m%s\033[0m\n' "$*"; }
hr()   { printf '\n\033[1;36m========== %s ==========\033[0m\n' "$*"; }

CMD="${1:-dev}"

# --- Build-all uchun qadam natijalarini yigʻuvchi (xato boʻlsa ham davom etadi) ---
SUMMARY=()
run_step() {
  local label="$1"; shift
  hr "$label"
  if "$@"; then
    SUMMARY+=("OK    : $label")
    return 0
  else
    local code=$?
    SUMMARY+=("SKIP/ERR ($code): $label")
    bold "⚠  '$label' bajarilmadi (kod $code). Davom etamiz."
    return "$code"
  fi
}

print_summary() {
  hr "Yakuniy natija"
  for line in "${SUMMARY[@]}"; do echo "  $line"; done
  echo ""
  echo "Artefaktlar: $ROOT/artifacts/"
  ls -lh "$ROOT/artifacts" 2>/dev/null || true
}

# --- Atomik qadamlar ---
setup_all() {
  hr "Paketlar (frontend)"
  npm install --no-fund --no-audit
  hr "Paketlar + Prisma + migratsiya (backend)"
  (cd api && npm install --no-fund --no-audit && npx prisma generate && npx prisma migrate deploy) || {
    bold "⚠  API migratsiya oʻtmadi — DB ishga tushganini tekshiring (./run.sh setup qaytadan)."
  }
}

web_build()  { hr "Frontend build (web)"; npm run build; }
api_build()  { hr "Backend build (API)"; (cd api && npm run build); }
apk_release(){ bash scripts/build-apk.sh release; }
apk_debug()  { bash scripts/build-apk.sh debug; }
aab_build()  { bash scripts/build-apk.sh aab; }
ios_sync()   { bash scripts/build-ios.sh sync; }
ios_archive(){ bash scripts/build-ios.sh archive; }

case "$CMD" in
  dev|"")        exec bash scripts/dev-stack.sh ;;
  backend|api)   exec bash -c 'cd api && npm run start:dev' ;;
  frontend|web)  exec npm run dev ;;
  setup)         setup_all ;;

  apk|apk:release) apk_release ;;
  apk:debug)       apk_debug ;;
  aab)             aab_build ;;
  apk:serve|serve)
    PORT="${2:-8080}"
    mkdir -p "$ROOT/artifacts"
    if ! ls "$ROOT/artifacts"/*.apk >/dev/null 2>&1; then
      bold "⚠  artifacts/ da APK yo'q. Avval:  ./run.sh apk   (yoki apk:debug)"
    fi
    IP="$(hostname -I 2>/dev/null | awk '{print $1}')"
    hr "Yuklab olish uchun ulashildi (Ctrl+C — to'xtatish)"
    echo "  Kompyuterdan:  http://localhost:${PORT}/"
    [[ -n "$IP" ]] && echo "  Telefondan (bir xil Wi-Fi):  http://${IP}:${PORT}/"
    echo "  Serverdan:     http://<server-ip>:${PORT}/"
    echo ""
    exec python3 -m http.server "$PORT" --directory "$ROOT/artifacts"
    ;;
  android)
    run_step "Android APK (release)" apk_release
    run_step "Android AAB (release)" aab_build
    print_summary
    ;;

  ios|ios:sync)  ios_sync ;;
  ios:archive)   ios_archive ;;

  deploy)
    if [[ ! -f "$ROOT/.env" ]]; then
      bold "⚠  .env topilmadi. Avval serverda:  cp .env.server.example .env  va qiymatlarni to'ldiring."
      exit 1
    fi
    hr "Docker: DB + API + web (build & up)"
    docker compose up -d --build
    echo ""
    bold "Tayyor. Sayt: http://<server-ip>:${WEB_PORT:-80}  (API: /api)"
    ;;
  deploy:logs)  docker compose logs -f ;;
  deploy:down)  docker compose down ;;

  build|all)
    run_step "Frontend build (web)" web_build
    run_step "Backend build (API)"  api_build
    run_step "Android APK (release)" apk_release
    run_step "Android AAB (release)" aab_build
    run_step "iOS sync (loyihani tayyorlash)" ios_sync
    if [[ "$CMD" == "all" && "$(uname -s)" == "Darwin" ]]; then
      run_step "iOS archive (.xcarchive/.ipa)" ios_archive
    fi
    print_summary
    ;;

  help|-h|--help)
    sed -n '2,100p' "$0" | awk '/^#/{sub(/^# ?/,"");print;next}{exit}'
    ;;
  *)
    echo "Nomaʼlum buyruq: $CMD"
    echo "Yordam: ./run.sh help"
    exit 1
    ;;
esac
