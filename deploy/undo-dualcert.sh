#!/usr/bin/env bash
#
# Mencabut sertifikat RSA pendamping yang dipasang versi lama tls-hardening.sh.
#
# Versi itu menyisipkan cert berdasarkan `grep "server_name.*${d}"`, dan
# "api.berani.site" MEMUAT "berani.site" — jadi cert api mendarat di server
# block berani.site. nginx memilih sertifikat pertama per tipe kunci, jadi
# domain induknya mulai menyajikan sertifikat subdomain dan browser menolaknya.
#
# Dipakai kalau `tls-hardening.sh --rollback` sudah tidak bisa (backup-nya
# tertimpa, atau sudah ada perubahan lain yang ingin dipertahankan). Kalau
# rollback masih memungkinkan, pakai itu — lebih menyeluruh.
#
#   bash undo-dualcert.sh          # tampilkan apa yang akan dibuang
#   bash undo-dualcert.sh --apply  # benar-benar buang
#
set -euo pipefail

APPLY=0
[ "${1:-}" = "--apply" ] && APPLY=1

[ "$(id -u)" -eq 0 ] || { echo "Jalankan sebagai root."; exit 1; }

say() { printf '\n\033[1m==> %s\033[0m\n' "$*"; }
ok()  { printf '    \033[32m✓\033[0m %s\n' "$*"; }
warn(){ printf '    \033[33m!\033[0m %s\n' "$*"; }

# File yang nginx benar-benar muat.
ALL_CONF=()
while IFS= read -r line; do
  [ -n "$line" ] && ALL_CONF+=("$line")
done < <(nginx -T 2>/dev/null | awk '/^# configuration file /{gsub(/:$/,"",$4); print $4}' | sort -u)

TARGETS=()
for c in ${ALL_CONF[@]+"${ALL_CONF[@]}"}; do
  [ -f "$c" ] || continue
  grep -q -- '-rsa/fullchain.pem' "$c" && TARGETS+=("$(readlink -f "$c")")
done

if [ "${#TARGETS[@]}" -eq 0 ]; then
  echo "Tidak ada baris *-rsa yang terpasang. Tidak ada yang perlu dibuang."
  exit 0
fi

say "Baris yang akan dibuang"
for f in "${TARGETS[@]}"; do
  echo "  $f"
  grep -n -- '-rsa/\(fullchain\|privkey\).pem' "$f" | sed 's/^/      /'
done

if [ "$APPLY" -eq 0 ]; then
  echo
  echo "Ini hanya pratinjau. Untuk benar-benar membuangnya:"
  echo "    bash $0 --apply"
  exit 0
fi

STAMP="$(date +%Y%m%d-%H%M%S)"
BACKUP="/root/undo-dualcert-$STAMP"
say "Backup"
for f in "${TARGETS[@]}"; do
  mkdir -p "$BACKUP$(dirname "$f")"
  cp -a "$f" "$BACKUP$f"
done
ok "Tersimpan di $BACKUP"

say "Membuang baris *-rsa"
for f in "${TARGETS[@]}"; do
  # Hanya baris ssl_certificate* yang menunjuk direktori -rsa. Sertifikat
  # aslinya (tanpa sufiks) tidak tersentuh, jadi situsnya tetap ber-HTTPS.
  #
  # grep -vE, bukan sed: pola `\(..\)\?` tidak sama di GNU sed dan BSD sed,
  # dan skrip yang hanya bisa diuji di server produksi sudah dua kali jadi
  # sumber masalah di sini.
  grep -vE '^[[:space:]]*ssl_certificate(_key)?[[:space:]].*-rsa/(fullchain|privkey)\.pem;' "$f" > "$f.tmp"
  mv "$f.tmp" "$f"
  ok "$(basename "$f")"
done

say "Uji konfigurasi"
if ! nginx -t; then
  warn "nginx -t GAGAL — mengembalikan."
  for f in "${TARGETS[@]}"; do cp -a "$BACKUP$f" "$f"; done
  nginx -t && systemctl reload nginx
  exit 1
fi
ok "nginx -t lolos"
systemctl reload nginx
ok "nginx di-reload"

say "Verifikasi dari luar"
# Sertifikat yang BENAR-BENAR disajikan, bukan yang tertulis di config.
BROKEN=0
DOMAINS=()
while IFS= read -r d; do
  [ -n "$d" ] && DOMAINS+=("$d")
done < <(awk '/server_name/ {for(i=2;i<=NF;i++){gsub(/;/,"",$i); if($i!="_") print $i}}' "${TARGETS[@]}" | sort -u)

for d in ${DOMAINS[@]+"${DOMAINS[@]}"}; do
  printf '    %-28s ' "$d"
  names="$(echo | openssl s_client -connect "$d:443" -servername "$d" 2>/dev/null \
    | openssl x509 -noout -ext subjectAltName 2>/dev/null \
    | tr ',' '\n' | sed 's/.*DNS://' | tr -d ' ' | grep -v '^$' | tr '\n' ' ')"
  if [ -z "$names" ]; then
    echo "? tidak bisa dihubungi"
  elif printf '%s' " $names" | grep -q " $d "; then
    printf 'OK  (%s)\n' "$(curl -sS -o /dev/null -w '%{http_code}' --max-time 10 "https://$d/" 2>/dev/null || echo '-')"
  else
    echo "MASIH SALAH -> $names"
    BROKEN=$((BROKEN + 1))
  fi
done

echo
if [ "$BROKEN" -gt 0 ]; then
  warn "$BROKEN domain masih menyajikan sertifikat yang salah."
  warn "Periksa manual; backup ada di $BACKUP"
  exit 1
fi
ok "Semua domain menyajikan sertifikatnya sendiri."
echo "    Backup: $BACKUP"
