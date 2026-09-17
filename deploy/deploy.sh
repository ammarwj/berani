#!/usr/bin/env bash
#
# Update BERANI di VPS: git pull, lalu deploy kalau memang ada perubahan.
#
#   bash deploy/deploy.sh                # keluar 0 tanpa apa-apa kalau tidak ada commit baru
#   bash deploy/deploy.sh --force        # deploy ulang di HEAD sekarang walau tidak ada commit baru
#   bash deploy/deploy.sh --allow-dirty  # izinkan working tree kotor
#
# Setup pertama kali: deploy/setup.sh
set -euo pipefail

WEB_DOMAIN="berani.my.id"
API_DOMAIN="api.berani.my.id"
BRANCH="main"

REPO_DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")/.." && pwd)"
COMPOSE_ENV="$REPO_DIR/.env"

FORCE=0
ALLOW_DIRTY=0
for arg in "$@"; do
  case "$arg" in
    --force) FORCE=1 ;;
    --allow-dirty) ALLOW_DIRTY=1 ;;
    *) echo "Argumen tidak dikenal: $arg" >&2; exit 2 ;;
  esac
done

red()  { printf '\033[31m%s\033[0m\n' "$*"; }
grn()  { printf '\033[32m%s\033[0m\n' "$*"; }
ylw()  { printf '\033[33m%s\033[0m\n' "$*"; }
step() { printf '\n\033[1m==> %s\033[0m\n' "$*"; }
die()  { red "GAGAL: $*"; exit 1; }

cd "$REPO_DIR"
compose() { docker compose -f docker-compose.yml -f docker-compose.prod.yml "$@"; }

[ -f "$REPO_DIR/api/.env" ] || die "api/.env tidak ada. VPS ini belum di-setup: jalankan deploy/setup.sh."
[ -f "$COMPOSE_ENV" ] || die ".env tidak ada. VPS ini belum di-setup: jalankan deploy/setup.sh."

# api/.env dan .env keduanya gitignored, jadi tidak pernah muncul di sini. Apa pun
# yang muncul adalah edit tangan di server yang akan tertimpa diam-diam oleh pull.
if [ -n "$(git status --porcelain)" ] && [ "$ALLOW_DIRTY" -eq 0 ]; then
  red "GAGAL: ada perubahan yang belum di-commit di $REPO_DIR:"
  git status --short
  echo
  echo "File-file itu akan hilang saat pull. Commit, stash, atau buang dulu."
  echo "Kalau memang disengaja:  bash deploy/deploy.sh --allow-dirty"
  exit 1
fi

# ---------------------------------------------------------------------------
step "Mengambil perubahan"
# ---------------------------------------------------------------------------
PREV_REV="$(git rev-parse HEAD)"
# --ff-only: jangan pernah membuat merge commit di server. Kalau tidak bisa
# fast-forward, ada yang salah dan itu urusan manusia.
git fetch origin "$BRANCH"
git merge --ff-only "origin/$BRANCH"
NEW_REV="$(git rev-parse HEAD)"

if [ "$PREV_REV" = "$NEW_REV" ] && [ "$FORCE" -eq 0 ]; then
  grn "Sudah paling baru ($(git rev-parse --short HEAD)). Tidak ada yang perlu di-deploy."
  echo "Kalau kamu mengubah api/.env atau konfigurasi lain:  bash deploy/deploy.sh --force"
  exit 0
fi

# ---------------------------------------------------------------------------
step "Menentukan yang perlu dibangun ulang"
# ---------------------------------------------------------------------------
BUILD_API=0
BUILD_WEB=0
if [ "$PREV_REV" = "$NEW_REV" ]; then
  # --force tanpa commit baru: konfigurasi berubah, bangun ulang semua.
  BUILD_API=1; BUILD_WEB=1
  echo "Mode --force di $(git rev-parse --short HEAD) — membangun ulang semuanya."
else
  CHANGED="$(git diff --name-only "$PREV_REV" "$NEW_REV")"
  echo "$CHANGED" | grep -q '^api/'           && BUILD_API=1
  echo "$CHANGED" | grep -q '^web/'           && BUILD_WEB=1
  echo "$CHANGED" | grep -q '^docker-compose' && { BUILD_API=1; BUILD_WEB=1; }
  echo "$PREV_REV..$NEW_REV — $(echo "$CHANGED" | wc -l | tr -d ' ') berkas berubah."
fi

if [ "$BUILD_API" -eq 0 ] && [ "$BUILD_WEB" -eq 0 ]; then
  # Commit baru tapi tidak menyentuh kode yang di-build (dokumen, nginx, script).
  grn "Tidak ada perubahan pada api/ maupun web/ — tidak perlu rebuild."
  if git diff --name-only "$PREV_REV" "$NEW_REV" | grep -q '^deploy/nginx/'; then
    ylw "Konfigurasi nginx berubah. Pasang manual, uji dulu sebelum reload:"
    ylw "    install -m 644 deploy/nginx/berani-http.conf /etc/nginx/conf.d/berani-http.conf"
    ylw "    nginx -t && systemctl reload nginx"
    ylw "CATATAN: berani.conf sudah ditulis ulang certbot (blok 443). Menyalinnya"
    ylw "ulang dari repo akan menghapus sertifikat dari konfigurasi — jangan, kecuali"
    ylw "kamu langsung menjalankan certbot lagi setelahnya."
  fi
  exit 0
fi

# ---------------------------------------------------------------------------
step "Membangun image"
# ---------------------------------------------------------------------------
# BUILD_ID jadi dua hal sekaligus: build arg NEXT_PUBLIC_BUILD_ID (di-inline ke
# bundle) dan nama cache service worker. Tanpa ini, browser pengunjung lama akan
# menyajikan HTML basi yang menunjuk chunk hash yang sudah tidak ada.
BUILD_ID="$(git rev-parse --short HEAD)"
sed -i "s/^BUILD_ID=.*/BUILD_ID=$BUILD_ID/" "$COMPOSE_ENV"
echo "BUILD_ID=$BUILD_ID"

TARGETS=()
[ "$BUILD_API" -eq 1 ] && TARGETS+=(api)
[ "$BUILD_WEB" -eq 1 ] && TARGETS+=(web)

# Build SEBELUM menyentuh container yang berjalan. Error kompilasi tidak boleh
# menjatuhkan situs yang sedang melayani — hanya build hijau yang lanjut.
if ! compose build "${TARGETS[@]}"; then
  git reset --hard "$PREV_REV"
  sed -i "s/^BUILD_ID=.*/BUILD_ID=$(git rev-parse --short HEAD)/" "$COMPOSE_ENV"
  die "build gagal. Kode dikembalikan ke $(git rev-parse --short HEAD); situs lama masih melayani."
fi
grn "Build berhasil."

# ---------------------------------------------------------------------------
step "Menjalankan versi baru"
# ---------------------------------------------------------------------------
compose up -d "${TARGETS[@]}"

healthy() {
  local url="$1" tries="$2"
  for _ in $(seq 1 "$tries"); do
    curl -fsS --max-time 5 "$url" >/dev/null 2>&1 && return 0
    sleep 2
  done
  return 1
}

# Cek lewat domain publik, bukan hanya port loopback: vhost rusak atau sertifikat
# kedaluwarsa hanya terlihat dari sini.
OK=1
if [ "$BUILD_API" -eq 1 ] && ! healthy "https://$API_DOMAIN/health" 30; then
  red "API tidak sehat."
  compose logs --tail=60 api
  OK=0
fi
if [ "$OK" -eq 1 ] && [ "$BUILD_WEB" -eq 1 ] && ! healthy "https://$WEB_DOMAIN/manifest.json" 30; then
  red "Web tidak sehat."
  compose logs --tail=60 web
  OK=0
fi

if [ "$OK" -eq 0 ]; then
  # Migrasi bersifat forward-only — db.Migrate tidak punya langkah down. Kalau
  # kegagalannya di migrasi, mengembalikan kode akan menyisakan binary lama
  # menghadapi skema yang sudah setengah bermigrasi: lebih rusak, bukan lebih baik.
  if compose logs --tail=200 api 2>/dev/null | grep -qi 'migrate:'; then
    red "Migrasi gagal — TIDAK melakukan rollback otomatis."
    echo
    echo "Migrasi forward-only: mengembalikan kode akan menjalankan binary lama di atas"
    echo "skema yang sudah sebagian bermigrasi. Perlu ditangani manual."
    echo
    echo "Lihat migrasi mana yang sudah tercatat:"
    echo "    docker compose -f docker-compose.yml -f docker-compose.prod.yml \\"
    echo "      exec -T postgres psql -U berani -d berani \\"
    echo "      -c 'SELECT * FROM schema_migrations ORDER BY version;'"
    exit 1
  fi

  ylw "Mengembalikan ke $(git rev-parse --short "$PREV_REV")…"
  git reset --hard "$PREV_REV"
  sed -i "s/^BUILD_ID=.*/BUILD_ID=$(git rev-parse --short HEAD)/" "$COMPOSE_ENV"
  compose build "${TARGETS[@]}" && compose up -d "${TARGETS[@]}"
  die "deploy gagal, sudah dikembalikan ke versi sebelumnya. Log ada di atas."
fi

step "Selesai"
grn "Ter-deploy di $BUILD_ID — $(git log -1 --pretty=%s)"
echo "  Web : https://$WEB_DOMAIN"
echo "  API : https://$API_DOMAIN"
