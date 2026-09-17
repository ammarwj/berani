#!/usr/bin/env bash
#
# Provisioning pertama kali BERANI di VPS. Jalankan sekali, sebagai root:
#
#   git clone git@github.com:ammarwj/berani.git /opt/berani
#   cd /opt/berani && bash deploy/setup.sh
#
# Setelah ini, update cukup: bash deploy/deploy.sh
#
# Asumsi: Debian/Ubuntu (nginx dengan sites-available + conf.d), Docker dan
# certbot sudah terpasang, DNS berani.site dan api.berani.site sudah menunjuk
# ke mesin ini.
set -euo pipefail

WEB_DOMAIN="berani.site"
API_DOMAIN="api.berani.site"
WEB_PORT=3004
API_PORT=8004
DB_PORT=5434

REPO_DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")/.." && pwd)"
API_ENV="$REPO_DIR/api/.env"
COMPOSE_ENV="$REPO_DIR/.env"
NGINX_VHOST="/etc/nginx/sites-available/berani.conf"
NGINX_HTTP="/etc/nginx/conf.d/berani-http.conf"

SKIP_DNS=0
CERTBOT_EMAIL=""
for arg in "$@"; do
  case "$arg" in
    --skip-dns-check) SKIP_DNS=1 ;;
    --email=*) CERTBOT_EMAIL="${arg#--email=}" ;;
    *) echo "Argumen tidak dikenal: $arg" >&2; exit 2 ;;
  esac
done

red()  { printf '\033[31m%s\033[0m\n' "$*"; }
grn()  { printf '\033[32m%s\033[0m\n' "$*"; }
ylw()  { printf '\033[33m%s\033[0m\n' "$*"; }
step() { printf '\n\033[1m==> %s\033[0m\n' "$*"; }
die()  { red "GAGAL: $*"; exit 1; }

# ---------------------------------------------------------------------------
# Semua pemeriksaan dulu, sebelum satu byte rahasia pun ditulis.
#
# api/.env bersifat tulis-sekali (lihat pemeriksaannya di bawah). Kalau script ini
# menulis rahasia lalu mati karena certbot tidak terpasang, mesin ini jadi tidak
# bisa lagi menjalankan setup.sh sama sekali — dan REFLECTION_KEY yang sudah
# tertulis belum sempat ditampilkan.
# ---------------------------------------------------------------------------
step "Memeriksa prasyarat"

[ "$(id -u)" -eq 0 ] || die "harus dijalankan sebagai root (butuh menulis ke /etc/nginx)."

for cmd in docker git openssl nginx curl; do
  command -v "$cmd" >/dev/null 2>&1 || die "'$cmd' tidak ditemukan. Pasang dulu."
done
docker compose version >/dev/null 2>&1 || die "'docker compose' (plugin v2) tidak tersedia."
command -v certbot >/dev/null 2>&1 || die "'certbot' tidak ditemukan. Pasang: apt install certbot python3-certbot-nginx"

# api/.env berisi REFLECTION_KEY, kunci AES-256-GCM untuk jurnal refleksi siswa.
# Kunci itu TIDAK bisa dibuat ulang: jurnal yang sudah terenkripsi hanya bisa
# dibaca dengan kunci yang sama. Menimpanya = menghanguskan seluruh isi jurnal
# secara permanen. Jadi script ini menolak, bukan menawarkan konfirmasi.
if [ -f "$API_ENV" ]; then
  red "GAGAL: $API_ENV sudah ada."
  echo
  echo "File itu berisi REFLECTION_KEY. Kunci itu tidak bisa dibuat ulang — jurnal"
  echo "refleksi yang sudah tersimpan hanya bisa didekripsi dengan kunci yang sama."
  echo "Menimpanya membuat semua jurnal siswa permanen tidak terbaca."
  echo
  echo "Kalau VPS ini memang sudah ter-setup, yang kamu cari adalah:"
  echo "    bash deploy/deploy.sh --force"
  echo
  echo "Kalau kamu benar-benar ingin mulai dari nol dan menerima kehilangan semua"
  echo "jurnal, hapus file itu secara sadar lebih dulu:  rm $API_ENV"
  exit 1
fi

# POSTGRES_PASSWORD hanya berlaku saat initdb — sekali volume terbentuk, password
# di dalamnya tetap. Password baru dari script ini tidak akan cocok dan api gagal
# konek dengan pesan autentikasi yang membingungkan.
if docker volume inspect berani_pgdata >/dev/null 2>&1; then
  red "GAGAL: volume 'berani_pgdata' sudah ada tapi $API_ENV tidak."
  echo
  echo "Password Postgres di dalam volume itu sudah tetap sejak initdb; password"
  echo "baru yang digenerate script ini tidak akan cocok."
  echo
  echo "Pilih salah satu:"
  echo "  a) Pulihkan api/.env dari backup, lalu jalankan: bash deploy/deploy.sh --force"
  echo "  b) Samakan password DB dengan yang baru — setelah setup selesai, jalankan:"
  echo "       docker compose exec -T postgres psql -U berani -d berani \\"
  echo "         -c \"ALTER USER berani WITH PASSWORD '<POSTGRES_PASSWORD dari api/.env>';\""
  echo "  c) Buang datanya (SEMUA laporan, jurnal, dan progres hilang):"
  echo "       docker volume rm berani_pgdata"
  exit 1
fi

for f in "$NGINX_VHOST" "$NGINX_HTTP"; do
  [ -e "$f" ] && die "$f sudah ada. Hapus atau pindahkan dulu kalau memang ingin setup ulang nginx."
done

# Port harus bebas sebelum compose mencoba bind — kegagalan di sini jauh lebih
# mudah dibaca daripada error bind dari Docker.
for p in "$WEB_PORT" "$API_PORT" "$DB_PORT"; do
  if (command -v ss >/dev/null 2>&1 && ss -ltn "sport = :$p" 2>/dev/null | grep -q LISTEN) ||
     (command -v lsof >/dev/null 2>&1 && lsof -iTCP:"$p" -sTCP:LISTEN >/dev/null 2>&1); then
    die "port $p sudah dipakai proses lain."
  fi
done

if [ "$SKIP_DNS" -eq 0 ]; then
  # certbot akan gagal kalau DNS belum menunjuk ke sini, dan kegagalannya terjadi
  # setelah stack menyala. Lebih baik ketahuan sekarang.
  server_ip="$(curl -fsS --max-time 10 https://api.ipify.org || true)"
  [ -n "$server_ip" ] || die "tidak bisa menentukan IP publik mesin ini. Ulangi dengan --skip-dns-check."
  for d in "$WEB_DOMAIN" "$API_DOMAIN"; do
    resolved="$(getent ahostsv4 "$d" 2>/dev/null | awk 'NR==1{print $1}')"
    [ -n "$resolved" ] || die "$d tidak resolve. Buat A record ke $server_ip, atau pakai --skip-dns-check."
    [ "$resolved" = "$server_ip" ] || die "$d menunjuk ke $resolved, bukan ke $server_ip. Perbaiki DNS, atau pakai --skip-dns-check."
  done
  grn "DNS: $WEB_DOMAIN dan $API_DOMAIN menunjuk ke $server_ip"
fi

grn "Semua prasyarat terpenuhi."

# ---------------------------------------------------------------------------
step "Membuat kredensial"
# ---------------------------------------------------------------------------
POSTGRES_PASSWORD="$(openssl rand -hex 24)"
JWT_SECRET="$(openssl rand -hex 48)"
# 32 byte = 64 hex chars, persis yang diminta crypto.New untuk AES-256.
REFLECTION_KEY="$(openssl rand -hex 32)"

umask 077
cat > "$API_ENV" <<EOF
# Digenerate oleh deploy/setup.sh pada $(date -Iseconds).
# JANGAN hapus file ini di server. Lihat catatan REFLECTION_KEY di bawah.

PORT=8080
# Nilai efektif di-override docker-compose.prod.yml (DB adalah service, bukan localhost).
DATABASE_URL=postgres://berani:$POSTGRES_PASSWORD@postgres:5432/berani?sslmode=disable
JWT_SECRET=$JWT_SECRET

# Nilai efektif di-override docker-compose.prod.yml menjadi https://$WEB_DOMAIN.
APP_BASE_URL=https://$WEB_DOMAIN

# Kunci AES-256-GCM untuk jurnal refleksi (PRD §8.2).
# TIDAK BISA DIBUAT ULANG: jurnal yang sudah terenkripsi hanya terbaca dengan kunci
# ini. Kehilangannya = semua jurnal siswa hilang permanen. Backup file ini offline.
REFLECTION_KEY=$REFLECTION_KEY

# Cloudflare R2 untuk lampiran laporan. Kosong = endpoint lampiran dimatikan,
# sisa aplikasi tetap jalan.
R2_ENDPOINT=
R2_ACCOUNT_ID=
R2_ACCESS_KEY_ID=
R2_SECRET_ACCESS_KEY=
R2_BUCKET=

# SMTP untuk email verifikasi & reset password. Kosong = email hanya ditulis ke log.
# Tanpa ini tidak ada yang bisa memverifikasi email atau mereset password sendiri.
SMTP_HOST=
SMTP_PORT=587
SMTP_USERNAME=
SMTP_PASSWORD=
SMTP_FROM=
EOF
chmod 600 "$API_ENV"

# File ini HANYA untuk substitusi variabel di docker-compose — tidak pernah
# disuntikkan ke dalam container. Rahasia aplikasi tetap di api/.env lewat env_file.
# Port di-bind ke 127.0.0.1 supaya hanya nginx (dan psql lokal) yang bisa menjangkau;
# tanpa prefix itu Docker membuka port ke seluruh internet, melewati ufw.
cat > "$COMPOSE_ENV" <<EOF
# Digenerate oleh deploy/setup.sh. Hanya untuk substitusi docker compose.
POSTGRES_PASSWORD=$POSTGRES_PASSWORD
BUILD_ID=setup
WEB_PORT=127.0.0.1:$WEB_PORT
API_PORT=127.0.0.1:$API_PORT
DB_PORT=127.0.0.1:$DB_PORT
EOF
chmod 600 "$COMPOSE_ENV"
umask 022

grn "api/.env dan .env dibuat (mode 600)."

# ---------------------------------------------------------------------------
step "Membangun dan menyalakan stack"
# ---------------------------------------------------------------------------
cd "$REPO_DIR"
BUILD_ID="$(git rev-parse --short HEAD 2>/dev/null || echo setup)"
sed -i "s/^BUILD_ID=.*/BUILD_ID=$BUILD_ID/" "$COMPOSE_ENV"

compose() { docker compose -f docker-compose.yml -f docker-compose.prod.yml "$@"; }

compose build
compose up -d

# --wait tidak ada di semua versi compose; polling manual jalan di mana saja.
echo "Menunggu API sehat (migrasi jalan saat start pertama, bisa agak lama)…"
for i in $(seq 1 60); do
  if curl -fsS --max-time 3 "http://127.0.0.1:$API_PORT/health" >/dev/null 2>&1; then
    grn "API sehat."
    break
  fi
  [ "$i" -eq 60 ] && { compose logs --tail=50 api; die "API tidak sehat setelah 120 detik. Log di atas."; }
  sleep 2
done

for i in $(seq 1 30); do
  if curl -fsS --max-time 3 "http://127.0.0.1:$WEB_PORT/manifest.json" >/dev/null 2>&1; then
    grn "Web sehat."
    break
  fi
  [ "$i" -eq 30 ] && { compose logs --tail=50 web; die "Web tidak sehat setelah 60 detik. Log di atas."; }
  sleep 2
done

# ---------------------------------------------------------------------------
step "Memasang konfigurasi nginx"
# ---------------------------------------------------------------------------
# Mesin ini juga melayani situs lain. Setiap perubahan diuji dengan `nginx -t` dan
# dibatalkan kalau ditolak — reload dengan konfigurasi rusak menjatuhkan semuanya.
install -m 644 "$REPO_DIR/deploy/nginx/berani-http.conf" "$NGINX_HTTP"
install -m 644 "$REPO_DIR/deploy/nginx/berani.conf" "$NGINX_VHOST"
ln -sf "$NGINX_VHOST" /etc/nginx/sites-enabled/berani.conf

if ! nginx -t; then
  rm -f /etc/nginx/sites-enabled/berani.conf "$NGINX_VHOST" "$NGINX_HTTP"
  die "nginx menolak konfigurasi (sudah dibatalkan, situs lain aman). Lihat pesan di atas."
fi
systemctl reload nginx
grn "nginx dimuat ulang. $WEB_DOMAIN dan $API_DOMAIN melayani lewat HTTP."

# ---------------------------------------------------------------------------
step "Meminta sertifikat TLS"
# ---------------------------------------------------------------------------
# certbot --nginx menulis ulang vhost di tempat: menambah blok 443 dan mengubah
# blok 80 jadi redirect. Kalau gagal, situs HTTP tetap melayani — jadi ini warning,
# bukan fatal.
certbot_args=(--nginx -d "$WEB_DOMAIN" -d "$API_DOMAIN" --redirect --agree-tos --non-interactive)
if [ -n "$CERTBOT_EMAIL" ]; then
  certbot_args+=(--email "$CERTBOT_EMAIL")
else
  certbot_args+=(--register-unsafely-without-email)
fi

if certbot "${certbot_args[@]}"; then
  grn "TLS aktif untuk $WEB_DOMAIN dan $API_DOMAIN."
  TLS_OK=1
else
  TLS_OK=0
  ylw "certbot gagal. Situs tetap melayani lewat HTTP."
  ylw "Ulangi setelah memperbaiki penyebabnya (biasanya DNS atau port 80 terblokir):"
  ylw "    certbot --nginx -d $WEB_DOMAIN -d $API_DOMAIN --redirect"
fi

# ---------------------------------------------------------------------------
step "Selesai"
# ---------------------------------------------------------------------------
scheme="http"; [ "$TLS_OK" -eq 1 ] && scheme="https"
echo
echo "  Web : $scheme://$WEB_DOMAIN"
echo "  API : $scheme://$API_DOMAIN"
echo
red "════════ KREDENSIAL — HANYA DITAMPILKAN SEKALI ════════"
echo "  POSTGRES_PASSWORD : $POSTGRES_PASSWORD"
echo "  JWT_SECRET        : $JWT_SECRET"
echo "  REFLECTION_KEY    : $REFLECTION_KEY"
echo
red "REFLECTION_KEY tidak bisa dibuat ulang. Jurnal refleksi siswa dienkripsi"
red "dengan kunci ini; kehilangannya membuat semuanya permanen tidak terbaca."
red "Simpan salinan $API_ENV di luar server ini, sekarang."
echo
ylw "Backup DB tanpa kunci ini tidak ada gunanya — keduanya harus disimpan bersama."
red "═══════════════════════════════════════════════════════"
echo
echo "Langkah berikutnya:"
echo
echo "  1. Isi SMTP_* di $API_ENV, lalu:  bash deploy/deploy.sh --force"
echo "     Tanpa SMTP, tidak ada yang bisa memverifikasi email atau mereset password."
echo
echo "  2. Isi R2_* kalau laporan perlu lampiran (opsional)."
echo
echo "  3. Buat akun super_admin pertama lewat psql:"
echo "       docker compose -f docker-compose.yml -f docker-compose.prod.yml \\"
echo "         exec -T postgres psql -U berani -d berani"
echo
red "     JANGAN jalankan api/seed/users.sql di sini — itu fixture dev dengan"
red "     password publik (berani123)."
echo
if [ "$TLS_OK" -eq 0 ]; then
  ylw "  4. Selesaikan TLS (lihat perintah certbot di atas), lalu jalankan"
  ylw "     deploy/deploy.sh --force supaya bundle web memakai URL https."
fi
echo "Update berikutnya cukup:  cd $REPO_DIR && bash deploy/deploy.sh"
