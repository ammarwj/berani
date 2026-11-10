# Deploy & operasi server

## `tls-hardening.sh`

Memperbaiki dua hal yang membuat aplikasi di VPS ini sering gagal dibuka dari
jaringan institusi (sekolah/kampus) meski normal dari jaringan pribadi:

- **HTTP/2** — sebelumnya ALPN hanya menawarkan `http/1.1`. Proxy institusi
  yang agresif kadang memutus koneksi yang negosiasi ALPN-nya tidak seperti
  yang ia harapkan, dan satu cold load halaman (22 request) jalan satu per satu.
- **OCSP stapling** — tanpa ini klien harus menghubungi Let's Encrypt sendiri
  untuk cek pencabutan sertifikat. Jaringan sekolah yang memblokir outbound itu
  membuat handshake menggantung atau gagal.

Aman diulang. Tiap tahap memverifikasi `nginx -t` sebelum reload, dan
mengembalikan seluruh konfigurasi kalau gagal.

```sh
bash deploy/tls-hardening.sh            # semua vhost ber-SSL
bash deploy/tls-hardening.sh berani     # hanya yang namanya cocok
bash deploy/tls-hardening.sh --rollback # batalkan
```

### Kenapa dual-cert RSA tidak lagi otomatis

Sertifikat ECDSA dari Let's Encrypt chain-nya berujung ke ISRG Root X2, root
yang relatif baru. Perangkat lama dan appliance SSL-inspection dengan trust
store usang menolaknya; sertifikat RSA chain-nya ke ISRG Root X1 yang hampir
semua perangkat percaya. Memasang keduanya membuat browser modern tetap
memilih ECDSA lewat negosiasi cipher, sementara yang lama kebagian RSA.

Versi skrip sebelumnya memasang itu otomatis, dan **merusak tiga situs**. Ia
mencari vhost dengan `grep "server_name.*${d}"` — dan `api.berani.site`
*memuat* `berani.site`, jadi sertifikat api disisipkan ke server block
`berani.site`. nginx memilih sertifikat **pertama** per tipe kunci, jadi
`berani.site` mulai menyajikan sertifikat `api.berani.site`, dan browser
menolaknya dengan `ERR_CERT_COMMON_NAME_INVALID`.

Yang membuatnya berbahaya bukan bug-nya, tapi bahwa **`nginx -t` lolos**.
Konfigurasinya sah; yang salah adalah sertifikat mana yang disajikan ke siapa —
dan itu hanya terlihat dari permintaan HTTPS sungguhan dari luar. Pengaman
skrip bersandar pada `nginx -t`, jadi rollback otomatisnya tidak akan pernah
terpicu.

Karena itu dual-cert sekarang **manual, per server block**, bukan ditebak dari
pencocokan nama.

### Memasang dual-cert dengan benar

Untuk satu domain, misal `berani.site`:

```sh
# 1. Terbitkan RSA dengan nama terpisah supaya tidak menimpa ECDSA yang ada
certbot certonly --nginx --key-type rsa --rsa-key-size 2048 \
  --cert-name berani.site-rsa -d berani.site

# 2. Buka vhost-nya, cari server block yang server_name-nya PERSIS domain itu
#    (bukan yang memuatnya sebagai bagian nama), lalu tambahkan pasangan kedua
#    di dalam block itu saja:
#
#      ssl_certificate     /etc/letsencrypt/live/berani.site/fullchain.pem;
#      ssl_certificate_key /etc/letsencrypt/live/berani.site/privkey.pem;
#      ssl_certificate     /etc/letsencrypt/live/berani.site-rsa/fullchain.pem;
#      ssl_certificate_key /etc/letsencrypt/live/berani.site-rsa/privkey.pem;

nginx -t && systemctl reload nginx
```

**Verifikasi dari luar server, bukan dari dalam.** `nginx -t` tidak cukup:

```sh
curl -sS -o /dev/null -w '%{http_code}\n' https://berani.site/
echo | openssl s_client -connect berani.site:443 -servername berani.site 2>/dev/null \
  | openssl x509 -noout -ext subjectAltName
```

Nama domainnya harus muncul di `subjectAltName`. Kalau tidak, vhost itu
menyajikan sertifikat domain lain — kembalikan segera.

### HSTS

Sengaja tidak dipasang. Header itu memerintahkan browser menolak HTTP untuk
domain ini selama berbulan-bulan, dan perintah itu **tidak bisa ditarik** dari
browser yang sudah menerimanya. Kalau ternyata sekolah memblokir di lapisan
TLS, HSTS mengunci siswa dari satu-satunya jalan keluar.

Pasang setelah akses dari jaringan sekolah terbukti stabil, mulai dari
`max-age` pendek:

```nginx
add_header Strict-Transport-Security "max-age=300" always;
```

### Yang tidak bisa diperbaiki dari server

Filter kategori "Newly Registered Domain". `berani.site` dibuat 17 September
2026, dan `.site` termasuk TLD yang sering diblokir massal. Untuk memastikan,
jalankan **dari jaringan sekolah**:

```sh
nslookup berani.site            # IP salah / NXDOMAIN -> DNS sekolah memblokir
curl -v https://berani.site/    # halaman blokir      -> filter kategori
```

Kalau itu penyebabnya, pilihannya cuma dua: minta IT sekolah mem-whitelist
`berani.site` dan `api.berani.site`, atau pindah ke domain `.id`/`.sch.id`
yang jarang kena filter — dan itu berarti menerbitkan ulang sertifikat serta
mengubah `NEXT_PUBLIC_API_URL` dan `APP_BASE_URL`.
