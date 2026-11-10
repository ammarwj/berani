#!/usr/bin/env bash
#
# Memperbaiki tiga hal yang membuat app di VPS ini sering gagal dibuka dari
# jaringan institusi (sekolah/kampus) meski normal dari jaringan pribadi:
#
#   2. HTTP/2 mati — ALPN hanya menawarkan http/1.1. Proxy institusi yang
#      agresif kadang memutus koneksi yang negosiasi ALPN-nya tidak seperti
#      yang ia harapkan, dan 22 request cold load jalan satu per satu.
#   3. Sertifikat hanya ECDSA, chain berujung ISRG Root X2 — root yang relatif
#      baru. Perangkat/appliance SSL-inspection dengan trust store lama
#      menolaknya. Sertifikat RSA chain-nya ke ISRG Root X1 yang jauh lebih
#      luas dipercaya. Dual-cert: browser modern tetap dapat ECDSA.
#   4. OCSP stapling mati — klien harus menghubungi Let's Encrypt sendiri untuk
#      cek pencabutan. Kalau jaringan sekolah memblokir outbound itu, handshake
#      gagal atau sangat lambat.
#
# HSTS sengaja TIDAK dipasang di sini. Lihat catatan di akhir file.
#
# Jalankan sebagai root di server. Aman diulang (idempoten). Tiap tahap
# memverifikasi `nginx -t` sebelum reload, dan membatalkan diri sendiri kalau
# konfigurasinya tidak sah.
#
#   bash tls-hardening.sh            # seluruh vhost yang punya SSL
#   bash tls-hardening.sh berani     # hanya vhost yang namanya cocok
#
set -euo pipefail

FILTER="${1:-}"
STAMP="$(date +%Y%m%d-%H%M%S)"
BACKUP="/root/nginx-backup-$STAMP"
SNIPPET="/etc/nginx/snippets/tls-compat.conf"

[ "$(id -u)" -eq 0 ] || { echo "Jalankan sebagai root."; exit 1; }
command -v nginx >/dev/null || { echo "nginx tidak ditemukan."; exit 1; }

say() { printf '\n\033[1m==> %s\033[0m\n' "$*"; }
ok()  { printf '    \033[32m✓\033[0m %s\n' "$*"; }
warn(){ printf '    \033[33m!\033[0m %s\n' "$*"; }

# Mengembalikan seluruh konfigurasi ke kondisi sebelum skrip ini jalan.
rollback() {
  warn "Mengembalikan konfigurasi dari $BACKUP"
  cp -a "$BACKUP/sites-available/." /etc/nginx/sites-available/ 2>/dev/null || true
  rm -f "$SNIPPET"
  nginx -t && systemctl reload nginx
  echo "Dikembalikan. Tidak ada perubahan yang tersisa."
}

say "0. Backup seluruh konfigurasi nginx"
mkdir -p "$BACKUP"
cp -a /etc/nginx/sites-available "$BACKUP/" 2>/dev/null || true
cp -a /etc/nginx/conf.d "$BACKUP/" 2>/dev/null || true
ok "Tersimpan di $BACKUP"
echo "    Batalkan kapan saja dengan: bash $0 --rollback"

if [ "$FILTER" = "--rollback" ]; then
  # Backup terbaru, bukan yang baru saja dibuat di atas.
  BACKUP="$(ls -1d /root/nginx-backup-* 2>/dev/null | sort | tail -2 | head -1)"
  [ -n "$BACKUP" ] || { echo "Tidak ada backup."; exit 1; }
  rollback
  exit 0
fi

say "1. Kondisi sekarang"
nginx -v 2>&1 | sed 's/^/    /'
openssl version | sed 's/^/    /'

# Vhost yang punya sertifikat — hanya itu yang perlu disentuh.
mapfile -t VHOSTS < <(grep -rl "ssl_certificate" /etc/nginx/sites-enabled/ 2>/dev/null | xargs -r -n1 readlink -f | sort -u)
if [ -n "$FILTER" ]; then
  mapfile -t VHOSTS < <(printf '%s\n' "${VHOSTS[@]}" | grep -- "$FILTER" || true)
fi
[ "${#VHOSTS[@]}" -gt 0 ] || { echo "Tidak ada vhost ber-SSL yang cocok."; exit 1; }

echo "    Vhost yang akan disentuh:"
printf '      %s\n' "${VHOSTS[@]}"

# Domain yang dilayani, untuk verifikasi di akhir.
mapfile -t DOMAINS < <(
  awk '/server_name/ {for(i=2;i<=NF;i++){gsub(/;/,"",$i); if($i!="_") print $i}}' "${VHOSTS[@]}" | sort -u
)

say "2. Snippet TLS bersama"
# Satu file yang di-include semua vhost, bukan blok yang disalin berkali-kali:
# empat salinan setelan TLS akan menyimpang diam-diam, dan yang menyimpang
# diam-diam di sini berarti satu situs tiba-tiba tidak bisa dibuka dari sekolah.
mkdir -p /etc/nginx/snippets
cat > "$SNIPPET" <<'EOF'
# Dikelola deploy/tls-hardening.sh. Jangan diedit manual — jalankan ulang
# skripnya supaya seluruh vhost ikut berubah bersamaan.
#
# Setelan ini menyasar klien di jaringan institusi: proxy SSL-inspection dan
# perangkat dengan trust store lama, bukan browser terbaru.

# TLS 1.2 ikut dipertahankan. Appliance inspeksi di banyak sekolah belum
# berbicara TLS 1.3; mematikannya membuat seluruh jaringan itu kehilangan akses
# demi keuntungan keamanan yang tipis untuk aplikasi tanpa data pembayaran.
ssl_protocols TLSv1.2 TLSv1.3;
ssl_prefer_server_ciphers off;
ssl_ciphers ECDHE-ECDSA-AES128-GCM-SHA256:ECDHE-RSA-AES128-GCM-SHA256:ECDHE-ECDSA-AES256-GCM-SHA384:ECDHE-RSA-AES256-GCM-SHA384:ECDHE-ECDSA-CHACHA20-POLY1305:ECDHE-RSA-CHACHA20-POLY1305:DHE-RSA-AES128-GCM-SHA256:DHE-RSA-AES256-GCM-SHA384;

ssl_session_timeout 1d;
ssl_session_cache shared:BeraniSSL:10m;
# Tickets off: tanpa rotasi kunci, session ticket merusak forward secrecy.
ssl_session_tickets off;

# OCSP stapling: server yang mengambil status pencabutan, lalu melampirkannya
# di handshake. Tanpa ini klien harus menghubungi Let's Encrypt sendiri — dan
# jaringan sekolah yang memblokir outbound itu membuat handshake menggantung.
ssl_stapling on;
ssl_stapling_verify on;
# Resolver dibutuhkan untuk menghubungi OCSP responder. Quad9 + Cloudflare:
# dua penyedia berbeda supaya satu yang diblokir tidak mematikan stapling.
resolver 9.9.9.9 1.1.1.1 valid=300s;
resolver_timeout 5s;
EOF
ok "Ditulis: $SNIPPET"

say "3. Pasang HTTP/2 + include snippet di tiap vhost"
for f in "${VHOSTS[@]}"; do
  echo "    $f"

  before="$(md5sum "$f" | cut -d' ' -f1)"

  # Bentuk lama (`listen 443 ssl http2;`) dibersihkan lebih dulu: sejak nginx
  # 1.25.1 ia deprecated, dan membiarkannya berarti ada dua sumber kebenaran.
  perl -0pi -e 's/^(\s*listen\s+443\s+ssl)\s+http2([^;]*;)/$1$2/mg' "$f"

  # Negative lookahead, bukan `grep -q` per file: satu file bisa memuat
  # beberapa server block, dan guard per-file akan melewatkan block kedua
  # kalau block pertama sudah punya http2. Lookahead menjamin tiap baris
  # listen dapat tepat satu, berapa kali pun skrip ini dijalankan.
  perl -0pi -e 's/^(\s*)(listen\s+443\s+ssl[^;]*;)(?!\s*\n\s*http2\s+on;)/$1$2\n$1http2 on;/mg' "$f"

  # Disisipkan setelah ssl_certificate_key, supaya pasti berada di dalam
  # server block yang benar — dan hanya kalau belum ada di block itu.
  perl -0pi -e "s|^(\s*)(ssl_certificate_key[^;]*;)(?!\s*\n\s*include \Q$SNIPPET\E;)|\$1\$2\n\$1include $SNIPPET;|mg" "$f"

  if [ "$before" = "$(md5sum "$f" | cut -d' ' -f1)" ]; then
    ok "sudah sesuai, tidak diubah"
  else
    ok "http2 + snippet dipasang"
  fi
done

say "4. Uji konfigurasi"
if ! nginx -t; then
  warn "Konfigurasi TIDAK sah — membatalkan semua perubahan."
  rollback
  exit 1
fi
ok "nginx -t lolos"
systemctl reload nginx
ok "nginx di-reload"

say "5. Sertifikat RSA pendamping (dual-cert)"
# Sertifikat ECDSA saja berarti chain ke ISRG Root X2, root yang belum ada di
# trust store perangkat lama. RSA chain-nya ke ISRG Root X1 yang hampir semua
# perangkat percaya. Keduanya dipasang bersama: browser modern memilih ECDSA
# lewat negosiasi cipher, yang lama tetap kebagian RSA.
if ! command -v certbot >/dev/null; then
  warn "certbot tidak ada — lewati. Pasang dulu, lalu jalankan ulang skrip ini."
else
  for d in "${DOMAINS[@]}"; do
    if [ -d "/etc/letsencrypt/live/${d}-rsa" ]; then
      ok "$d: sertifikat RSA sudah ada"
      continue
    fi
    echo "    Menerbitkan RSA untuk $d …"
    if certbot certonly --nginx --non-interactive --agree-tos \
         --key-type rsa --rsa-key-size 2048 \
         --cert-name "${d}-rsa" -d "$d"; then
      ok "$d: sertifikat RSA terbit"
      # Pasangan ssl_certificate kedua di server block domain ini.
      for f in "${VHOSTS[@]}"; do
        grep -q "server_name.*\b${d}\b" "$f" || continue
        grep -q "${d}-rsa" "$f" && continue
        perl -0pi -e "s|^(\s*)(include \Q$SNIPPET\E;)|\$1ssl_certificate /etc/letsencrypt/live/${d}-rsa/fullchain.pem;\n\$1ssl_certificate_key /etc/letsencrypt/live/${d}-rsa/privkey.pem;\n\$1\$2|m" "$f"
        ok "$d: dual-cert dipasang di $(basename "$f")"
      done
    else
      warn "$d: penerbitan RSA gagal — ECDSA yang lama tetap dipakai, situs tetap jalan"
    fi
  done

  if nginx -t; then
    systemctl reload nginx
    ok "nginx di-reload dengan dual-cert"
  else
    warn "Konfigurasi tidak sah setelah dual-cert — membatalkan."
    rollback
    exit 1
  fi
fi

say "6. Verifikasi"
for d in "${DOMAINS[@]}"; do
  echo "    --- $d ---"
  printf '      ALPN      : '
  echo | openssl s_client -alpn h2,http/1.1 -connect "$d:443" -servername "$d" 2>/dev/null \
    | grep -i "ALPN protocol" | sed 's/.*: //' || echo "?"
  printf '      Stapling  : '
  if echo | openssl s_client -connect "$d:443" -servername "$d" -status 2>/dev/null | grep -q "OCSP Response Status: successful"; then
    echo "aktif"
  else
    echo "BELUM (butuh 1-2 menit setelah reload, cek lagi)"
  fi
  printf '      HTTP      : '
  curl -sS -o /dev/null -w '%{http_code} (HTTP/%{http_version})\n' --max-time 10 "https://$d/" || echo gagal
done

cat <<EOF

==> Selesai.

Backup  : $BACKUP
Batalkan: bash $0 --rollback

Yang TIDAK dipasang, dan alasannya:

  HSTS. Header itu memerintahkan browser menolak HTTP untuk domain ini selama
  berbulan-bulan ke depan, dan perintah itu TIDAK BISA ditarik dari browser
  yang sudah menerimanya. Kalau ternyata sekolah justru memblokir di lapisan
  TLS, HSTS mengunci siswa dari satu-satunya jalan keluar. Pasang setelah
  akses dari jaringan sekolah terbukti stabil, dimulai dari max-age pendek:

    add_header Strict-Transport-Security "max-age=300" always;

Yang masih mungkin tersisa: filter kategori "Newly Registered Domain".
berani.site dibuat 17 September 2026 dan .site termasuk TLD yang sering
diblokir. Itu tidak bisa diperbaiki dari server. Untuk memastikan, jalankan
DARI jaringan sekolah:

    nslookup berani.site      # IP salah / NXDOMAIN  -> DNS sekolah memblokir
    curl -v https://berani.site/   # halaman blokir  -> filter kategori
EOF
