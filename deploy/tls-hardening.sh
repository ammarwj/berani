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
#
# Backup mencerminkan path penuh (BACKUP/etc/nginx/…), bukan hanya
# sites-available: vhost di server ini bisa berada di conf.d/, di direktori
# panel hosting, atau di /opt — dan rollback yang hanya mengenal satu lokasi
# akan diam-diam gagal persis saat ia paling dibutuhkan.
rollback() {
  warn "Mengembalikan konfigurasi dari $BACKUP"
  [ -d "$BACKUP" ] || { echo "Backup $BACKUP tidak ada."; return 1; }
  (cd "$BACKUP" && find . -type f -print0 | while IFS= read -r -d '' rel; do
    cp -a "$rel" "/${rel#./}"
  done)
  # Snippet dibuat skrip ini, jadi dibuang — kecuali ia memang sudah ada
  # sebelumnya dan ikut terbackup.
  [ -f "$BACKUP$SNIPPET" ] || rm -f "$SNIPPET"
  nginx -t && systemctl reload nginx
  echo "Dikembalikan. Tidak ada perubahan yang tersisa."
}

if [ "$FILTER" = "--rollback" ]; then
  BACKUP="$(ls -1d /root/nginx-backup-* 2>/dev/null | sort | tail -1)"
  [ -n "$BACKUP" ] || { echo "Tidak ada backup."; exit 1; }
  rollback
  exit 0
fi

say "0. Backup seluruh konfigurasi nginx"
mkdir -p "$BACKUP"
# Seluruh /etc/nginx, plus file apa pun di luar itu yang ikut dimuat.
tar -cf - /etc/nginx 2>/dev/null | (cd "$BACKUP" && tar -xf -) || true
ok "Tersimpan di $BACKUP"
echo "    Batalkan kapan saja dengan: bash $0 --rollback"

say "1. Kondisi sekarang"
nginx -v 2>&1 | sed 's/^/    /'
openssl version | sed 's/^/    /'

# Vhost yang punya sertifikat — hanya itu yang perlu disentuh.
#
# Daftar file datang dari `nginx -T`, bukan dari isi sites-enabled/: hanya nginx
# sendiri yang tahu file mana yang benar-benar dimuat. Tata letak di luar
# konvensi Debian — conf.d/, /etc/nginx/vhosts/, atau panel hosting yang
# menaruhnya di /opt — tetap ketemu, dan file yang ADA di sites-available tapi
# tidak di-symlink tidak ikut tersentuh.
#
# `while read`, bukan `mapfile`: mapfile hanya ada di bash 4+, dan skrip yang
# tidak bisa diuji di luar server produksi adalah skrip yang pertama kali
# dijalankan justru di tempat paling mahal untuk salah.
ALL_CONF=()
while IFS= read -r line; do
  [ -n "$line" ] && ALL_CONF+=("$line")
done < <(nginx -T 2>/dev/null | awk '/^# configuration file /{gsub(/:$/,"",$4); print $4}' | sort -u)

VHOSTS=()
for c in "${ALL_CONF[@]}"; do
  [ -f "$c" ] || continue
  # ssl_certificate_key, bukan ssl_certificate: yang kedua juga cocok dengan
  # baris ssl_certificate_key itu sendiri, dan dengan snippet TLS bersama yang
  # tidak punya server block untuk disisipi apa pun.
  grep -qE '^[[:space:]]*ssl_certificate_key[[:space:]]' "$c" || continue
  resolved="$(readlink -f "$c")"
  # Dedup tanpa sort -u: satu file bisa di-include dua kali.
  seen=0
  for v in ${VHOSTS[@]+"${VHOSTS[@]}"}; do [ "$v" = "$resolved" ] && seen=1 && break; done
  [ "$seen" -eq 0 ] && VHOSTS+=("$resolved")
done

if [ -n "$FILTER" ]; then
  FILTERED=()
  for v in ${VHOSTS[@]+"${VHOSTS[@]}"}; do
    case "$v" in *"$FILTER"*) FILTERED+=("$v") ;; esac
  done
  VHOSTS=(${FILTERED[@]+"${FILTERED[@]}"})
fi

if [ "${#VHOSTS[@]}" -eq 0 ]; then
  echo "Tidak ada vhost ber-SSL yang cocok."
  echo
  echo "File konfigurasi yang nginx muat:"
  printf '  %s\n' ${ALL_CONF[@]+"${ALL_CONF[@]}"}
  echo
  if [ -n "$FILTER" ]; then
    echo "Filter '$FILTER' mungkin tidak cocok dengan nama file mana pun di atas."
    echo "Coba tanpa filter: bash $0"
  else
    echo "Tidak satu pun memuat ssl_certificate_key — artinya HTTPS belum"
    echo "dikonfigurasi lewat nginx di server ini. Jalankan certbot dulu:"
    echo "    certbot --nginx -d berani.site -d api.berani.site"
  fi
  exit 1
fi

echo "    Vhost yang akan disentuh:"
printf '      %s\n' "${VHOSTS[@]}"

# Vhost di luar /etc/nginx (panel hosting, /opt) belum ikut tar di tahap 0.
for f in "${VHOSTS[@]}"; do
  case "$f" in
    /etc/nginx/*) ;;
    *) mkdir -p "$BACKUP$(dirname "$f")" && cp -a "$f" "$BACKUP$f"
       warn "di luar /etc/nginx, ikut dibackup: $f" ;;
  esac
done

# Domain yang dilayani, untuk verifikasi di akhir.
DOMAINS=()
while IFS= read -r d; do
  [ -n "$d" ] && DOMAINS+=("$d")
done < <(awk '/server_name/ {for(i=2;i<=NF;i++){gsub(/;/,"",$i); if($i!="_") print $i}}' "${VHOSTS[@]}" | sort -u)

say "2. Snippet TLS bersama"
# Satu file yang di-include semua vhost, bukan blok yang disalin berkali-kali:
# empat salinan setelan TLS akan menyimpang diam-diam, dan yang menyimpang
# diam-diam di sini berarti satu situs tiba-tiba tidak bisa dibuka dari sekolah.
#
# Isinya HANYA yang belum diatur certbot. Vhost yang pernah disentuh
# `certbot --nginx` sudah meng-include /etc/letsencrypt/options-ssl-nginx.conf,
# yang menyetel ssl_protocols, ssl_ciphers, ssl_session_cache dan
# ssl_session_timeout. Mengulanginya bukan sekadar mubazir — nginx menolak
# start dengan "directive is duplicate", dan seluruh situs di server ikut mati.
mkdir -p /etc/nginx/snippets
cat > "$SNIPPET" <<'EOF'
# Dikelola deploy/tls-hardening.sh. Jangan diedit manual — jalankan ulang
# skripnya supaya seluruh vhost ikut berubah bersamaan.
#
# HANYA berisi direktif yang tidak pernah diatur certbot. Vhost yang pernah
# disentuh `certbot --nginx` meng-include /etc/letsencrypt/options-ssl-nginx.conf
# di level yang sama, dan di nginx direktif ganda pada level yang sama bukan
# peringatan — ia menolak start, jadi SELURUH situs di server ikut mati. Karena
# itu ssl_protocols, ssl_ciphers, ssl_session_cache dan ssl_session_timeout
# sengaja tidak ada di sini: certbot sudah menyetelnya ke nilai yang memadai
# (TLS 1.2 + 1.3), dan mengubahnya bukan bagian dari perbaikan ini.

# OCSP stapling: server yang mengambil status pencabutan, lalu melampirkannya
# di handshake. Tanpa ini klien harus menghubungi Let's Encrypt sendiri — dan
# jaringan sekolah yang memblokir outbound itu membuat handshake menggantung
# atau gagal sama sekali.
ssl_stapling on;
ssl_stapling_verify on;

# Resolver dibutuhkan untuk menghubungi OCSP responder. Quad9 + Cloudflare:
# dua penyedia berbeda supaya satu yang diblokir tidak mematikan stapling.
resolver 9.9.9.9 1.1.1.1 valid=300s;
resolver_timeout 5s;
EOF
ok "Ditulis: $SNIPPET"
echo "    Isi: ssl_stapling + resolver saja — sisanya dibiarkan apa adanya."

# Pengaman kedua: vhost yang SUDAH menyetel ssl_stapling sendiri akan
# menggandakannya begitu snippet ini di-include, dan di nginx itu fatal.
# Dilewati, bukan dipaksakan — rollback memang menyelamatkan server, tapi pesan
# yang menyebut file mana jauh lebih berguna daripada "test failed".
#
# `nginx -T`, bukan isi file mentah: direktifnya bisa datang dari include lain
# (misal snippet TLS milik panel hosting) yang tidak kelihatan dari vhost-nya.
# Tapi -T menggabungkan semua server block jadi satu aliran, jadi pemeriksaan
# per-vhost tetap dari filenya, dan -T hanya dipakai untuk memastikan snippet
# ini belum ter-include di mana pun.
SKIPPED=()
KEEP=()
for f in "${VHOSTS[@]}"; do
  # Sudah meng-include snippet ini → include kedua = direktif ganda.
  if grep -qF "$SNIPPET" "$f"; then
    SKIPPED+=("$f (snippet sudah ter-include)")
    continue
  fi
  if grep -qE '^[[:space:]]*ssl_stapling[[:space:]]' "$f"; then
    SKIPPED+=("$f (punya ssl_stapling sendiri)")
    continue
  fi
  KEEP+=("$f")
done
if [ "${#SKIPPED[@]}" -gt 0 ]; then
  for s in ${SKIPPED[@]+"${SKIPPED[@]}"}; do
    warn "dilewati: $s"
  done
fi
# Daftar penuh disimpan: tahap dual-cert tetap perlu menyentuh vhost yang
# dilewati di sini — yang disaring hanyalah pemasangan snippet.
ALL_VHOSTS=(${VHOSTS[@]+"${VHOSTS[@]}"})
VHOSTS=(${KEEP[@]+"${KEEP[@]}"})
if [ "${#VHOSTS[@]}" -eq 0 ]; then
  echo
  echo "Semua vhost sudah dikonfigurasi — tidak ada yang perlu diubah."
  echo "Lanjut ke verifikasi."
fi

say "3. Pasang HTTP/2 + include snippet di tiap vhost"
for f in ${VHOSTS[@]+"${VHOSTS[@]}"}; do
  echo "    $f"

  before="$(md5sum "$f" | cut -d' ' -f1)"

  # Bentuk lama (`listen 443 ssl http2;`) dibersihkan lebih dulu: sejak nginx
  # 1.25.1 ia deprecated, dan membiarkannya berarti ada dua sumber kebenaran.
  perl -0pi -e 's/^(\s*listen\s+[^;]*\bssl\b[^;]*)\s+http2([^;]*;)/$1$2/mg' "$f"

  # http2 dan include disisipkan per SERVER BLOCK, bukan per baris — itu
  # cakupan keduanya. Satu blok lazim punya dua listen (IPv4 dan `[::]`), dan
  # blok dual-cert punya dua ssl_certificate_key; regex per-baris memberi dua
  # direktif di blok yang sama, dan nginx menolaknya sebagai "directive is
  # duplicate" — seluruh server ikut mati, bukan satu situs.
  #
  # Butuh pelacak kedalaman kurung, jadi awk, bukan regex: blok bisa memuat
  # location{} bersarang, dan `}` pertama bukan akhir blok.
  awk -v snip="$SNIPPET" '
    # Buffer satu server block, putuskan di akhir blok — saat sudah diketahui
    # apa saja yang ada di dalamnya. Tepat satu http2 dan satu include per blok.
    function flush_block(   i, ind, did_http2, did_inc) {
      for (i = 1; i <= n; i++) {
        print buf[i]
        match(buf[i], /^[[:space:]]*/); ind = substr(buf[i], 1, RLENGTH)
        if (!did_http2 && has_ssl && !has_http2 && buf[i] ~ /^[[:space:]]*listen[[:space:]][^;]*ssl[^;]*;/) {
          print ind "http2 on;"; did_http2 = 1
        }
        if (!did_inc && has_key && !has_inc && buf[i] ~ /^[[:space:]]*ssl_certificate_key[[:space:]]/) {
          print ind "include " snip ";"; did_inc = 1
        }
      }
      n = 0; has_ssl = 0; has_http2 = 0; has_key = 0; has_inc = 0
    }
    /^[[:space:]]*server[[:space:]]*\{/ && depth == 0 { inblock = 1 }
    {
      if (inblock) {
        buf[++n] = $0
        if ($0 ~ /^[[:space:]]*listen[[:space:]][^;]*ssl[^;]*;/) has_ssl = 1
        if ($0 ~ /^[[:space:]]*http2[[:space:]]/) has_http2 = 1
        if ($0 ~ /^[[:space:]]*ssl_certificate_key[[:space:]]/) has_key = 1
        if (index($0, snip) > 0) has_inc = 1
      } else print
      depth += gsub(/\{/, "{")
      depth -= gsub(/\}/, "}")
      if (inblock && depth == 0) { flush_block(); inblock = 0 }
    }
    # Kurung tidak seimbang (file terpotong): cetak apa adanya, jangan menebak.
    END { for (i = 1; i <= n; i++) print buf[i] }
  ' "$f" > "$f.tmp" && mv "$f.tmp" "$f"

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

say "5. Sertifikat RSA pendamping (dual-cert) — DIBUANG"
cat <<'EOF'
    Tahap ini sengaja tidak ada lagi. Versi sebelumnya menyisipkan sertifikat
    RSA ke vhost mana pun yang server_name-nya MEMUAT nama domain itu — dan
    "api.berani.site" memuat "berani.site", jadi cert api disisipkan ke server
    block berani.site. nginx memilih sertifikat PERTAMA per tipe kunci, jadi
    berani.site mulai menyajikan sertifikat api.berani.site dan browser
    menolaknya: ERR_CERT_COMMON_NAME_INVALID.

    Yang membuatnya berbahaya bukan bug-nya, tapi bahwa `nginx -t` LOLOS.
    Konfigurasinya sah; yang salah adalah sertifikat mana yang disajikan ke
    siapa — dan itu hanya terlihat dari luar, lewat permintaan HTTPS sungguhan.
    Pengaman skrip ini bersandar pada `nginx -t`, jadi ia tidak akan menangkapnya.

    Dual-cert tetap berguna untuk perangkat lama (chain ISRG Root X1), tapi ia
    harus dipasang per server block secara manual, bukan ditebak dari
    pencocokan nama. Langkahnya ada di README deploy/.
EOF

say "6. Verifikasi"
# Verifikasi dari luar, bukan dari config: `nginx -t` bisa lolos sementara
# browser menolak situsnya.
BROKEN=0
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
  # Nama di sertifikat yang BENAR-BENAR disajikan. `nginx -t` tidak memeriksa
  # ini: config yang sah tetap bisa menyajikan sertifikat domain lain, dan
  # browser menolaknya meski server sehat. Ini satu-satunya cek yang menangkap
  # kelas kesalahan itu, jadi ia harus ada meski terlihat berlebihan.
  printf '      Cert utk  : '
  CERT_NAMES="$(echo | openssl s_client -connect "$d:443" -servername "$d" 2>/dev/null \
    | openssl x509 -noout -ext subjectAltName 2>/dev/null | tr ',' '\n' | sed 's/.*DNS://' | tr -d ' ' | grep -v '^$' | tr '\n' ' ')"
  if [ -z "$CERT_NAMES" ]; then
    echo "? (tidak bisa dibaca)"
  elif printf '%s' " $CERT_NAMES" | grep -q " $d "; then
    echo "$CERT_NAMES"
  else
    echo "SALAH -> $CERT_NAMES"
    warn "$d menyajikan sertifikat domain lain. Browser akan menolaknya."
    BROKEN=$((BROKEN + 1))
  fi

  printf '      HTTP      : '
  if curl -sS -o /dev/null -w '%{http_code} (HTTP/%{http_version})\n' --max-time 10 "https://$d/" 2>/dev/null; then
    :
  else
    echo "GAGAL"
    BROKEN=$((BROKEN + 1))
  fi
done

if [ "${BROKEN:-0}" -gt 0 ]; then
  echo
  warn "$BROKEN pemeriksaan GAGAL — situs di atas tidak bisa dibuka browser."
  warn "Batalkan sekarang:  bash $0 --rollback"
  exit 1
fi

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
