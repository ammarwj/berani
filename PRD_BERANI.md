# Product Requirements Document (PRD)
# BERANI — Belajar, Edukasi, & Aman Terhadap Bullying

| | |
|---|---|
| **Versi Dokumen** | 1.0 |
| **Tanggal** | 13 September 2026 |
| **Status** | Draft |
| **Pemilik Produk** | *(diisi)* |
| **Tipe Produk** | Progressive Web App (PWA) |

---

## 1. Latar Belakang

Bullying (perundungan), baik secara fisik, verbal, sosial, maupun digital (cyberbullying), masih menjadi masalah serius di lingkungan sekolah maupun komunitas. Banyak korban tidak berani melapor karena takut identitasnya terungkap, takut dibalas, atau tidak tahu harus melapor ke mana.

**BERANI** hadir sebagai web app edukasi sekaligus sistem pelaporan bullying yang aman, mudah diakses, dan dapat diinstal layaknya aplikasi native (PWA), dengan menggabungkan aspek edukasi, refleksi diri, latihan keterampilan, dan pelaporan — termasuk opsi pelaporan anonim.

## 2. Tujuan Produk

1. Meningkatkan pemahaman pengguna (siswa/masyarakat) tentang bullying, jenis-jenisnya, dan dampaknya melalui konten edukasi.
2. Membantu pengguna melakukan refleksi diri terkait pengalaman atau perilaku mereka.
3. Melatih keterampilan pengguna dalam menghadapi/mencegah bullying melalui modul latihan interaktif.
4. Menyediakan kanal pelaporan bullying yang aman, cepat, dan dapat dilakukan secara anonim.
5. Memberikan pengalaman aplikasi yang cepat, ringan, dan bisa diinstal di perangkat (PWA) tanpa perlu App Store/Play Store.

## 3. Target Pengguna

| Persona | Deskripsi | Kebutuhan Utama |
|---|---|---|
| **Siswa (Pelapor/Korban)** | Usia 10–18 tahun, mengalami/menyaksikan bullying | Rasa aman, anonimitas, kemudahan lapor |
| **Siswa (Umum)** | Ingin belajar & melatih diri | Konten edukasi menarik, latihan interaktif |
| **Guru/BK/Admin Sekolah** | Menindaklanjuti laporan | Dashboard laporan, manajemen kasus |
| **Orang Tua (opsional, fase lanjut)** | Memantau edukasi anak | Ringkasan progres belajar anak |

## 4. Ruang Lingkup (Scope)

### 4.1 Termasuk (In-Scope) — Versi 1.0
- Autentikasi pengguna (login/register)
- 4 fitur utama: **Edukasi, Refleksi, Latihan, Lapor**
- Pelaporan anonim (tanpa mengaitkan identitas akun ke laporan)
- PWA: installable, offline-ready dasar, responsive
- Dashboard admin/guru untuk menindaklanjuti laporan

### 4.2 Tidak Termasuk (Out-of-Scope) — Versi 1.0
- Chat/konseling real-time dengan psikolog
- Integrasi dengan sistem akademik sekolah (SIS)
- Aplikasi native iOS/Android terpisah (cukup PWA)
- Notifikasi push kompleks (bisa masuk fase 2)

## 5. Fitur Utama

### 5.1 🎓 Edukasi
Modul pembelajaran interaktif seputar bullying.

**Requirement:**
- Daftar materi berbentuk kategori (Apa itu Bullying, Jenis-jenis Bullying, Dampak, Cara Menghadapi, Cyberbullying, dll.)
- Format konten: artikel, infografis, video (embed), kuis singkat di akhir materi
- Progress tracking (materi yang sudah dibaca/selesai)
- Badge/sertifikat sederhana setelah menyelesaikan modul (gamifikasi ringan)

**User Story:**
> Sebagai siswa, saya ingin membaca materi edukasi tentang bullying agar saya lebih paham cara mengenali dan menghadapinya.

### 5.2 🪞 Refleksi
Ruang bagi pengguna untuk melakukan refleksi diri secara privat.

**Requirement:**
- Jurnal refleksi harian/mingguan dengan pertanyaan pemandu (guided prompts), misalnya: "Apakah hari ini kamu merasa aman di sekolah?"
- Mood tracker sederhana (emoji/skala perasaan)
- Riwayat refleksi hanya bisa dilihat oleh pemilik akun (privat, terenkripsi)
- Opsional: rekomendasi materi edukasi berdasarkan hasil refleksi

**User Story:**
> Sebagai siswa, saya ingin mencatat perasaan saya setiap hari agar saya lebih sadar akan kondisi emosional saya.

### 5.3 💪 Latihan
Simulasi/skenario interaktif untuk melatih respons terhadap situasi bullying.

**Requirement:**
- Skenario pilihan ganda berbasis situasi nyata (misal: "Temanmu diejek di depan umum, apa yang kamu lakukan?")
- Feedback langsung atas pilihan yang diambil beserta penjelasan
- Latihan komunikasi asertif (contoh kalimat untuk menolak/melapor)
- Skor/progress latihan untuk memantau perkembangan

**User Story:**
> Sebagai siswa, saya ingin berlatih menghadapi situasi bullying lewat simulasi agar saya lebih siap jika mengalaminya di dunia nyata.

### 5.4 🚨 Lapor
Fitur inti untuk melaporkan kejadian bullying, dengan opsi anonim.

**Requirement:**
- Form laporan: jenis bullying, deskripsi kejadian, lokasi, waktu, pihak terlibat (opsional), lampiran bukti (foto/screenshot/dokumen)
- **Toggle "Kirim sebagai Anonim"**:
  - Jika aktif → data pelapor (user_id) **tidak disimpan/tidak ditautkan** ke laporan
  - Jika nonaktif → laporan tertaut ke akun pelapor untuk keperluan tindak lanjut
- Kategori tingkat urgensi (sangat mendesak/mendesak/tidak mendesak)
- Nomor tiket laporan agar pengguna anonim tetap bisa memantau status tanpa login ulang menautkan identitas
- Notifikasi status laporan (Diterima → Diproses → Ditindaklanjuti → Selesai)
- Dashboard admin untuk melihat, mengelola, dan merespons laporan

**User Story:**
> Sebagai siswa yang menjadi korban bullying, saya ingin melapor secara anonim agar identitas saya tetap aman dari risiko pembalasan.

> Sebagai admin/guru BK, saya ingin melihat daftar laporan masuk dan menindaklanjutinya sesuai prioritas.

## 6. Alur Anonimitas Laporan (Penting)

> **Revisi (migrasi `0005_reporter_identity.sql`).** Versi awal bagian ini menetapkan bahwa `user_id` tidak disimpan sama sekali untuk laporan anonim — admin pun tidak bisa menelusurinya. Aturan itu **diganti**: guru pendamping tidak bisa menindaklanjuti laporan (menghubungi wali kelas, memisahkan siswa, memanggil orang tua) tanpa tahu siapa pelapornya. "Anonim" sekarang berarti **tersembunyi dari siswa lain, bukan dari guru pendamping**.

Karena aplikasi mewajibkan login, dan laporan tetap harus terasa aman untuk dikirim:

1. Pengguna tetap harus login untuk mengakses fitur Lapor (mencegah spam/bot).
2. Saat submit laporan dengan toggle **"Anonim" aktif**:
   - Backend menyimpan `user_id` pelapor dan menandai `reports.anonymous = TRUE`.
   - Dashboard guru/admin menampilkan nama & email pelapor, disertai badge **"mode anonim"** sebagai pengingat bahwa siswa itu meminta kerahasiaan.
   - Sistem tetap menghasilkan **kode tiket unik** untuk tracking status tanpa login.
   - Metadata yang berpotensi mengidentifikasi (IP address, device fingerprint) **tidak disimpan** bersama laporan.
3. Saat toggle **nonaktif**, laporan dikirim dengan nama tertera seperti biasa.
4. Log audit sistem tetap dipisahkan dari data laporan.

> ⚠️ **Catatan desain sistem:** karena identitas kini tersimpan, **kejujuran copy di form lapor menjadi kontrolnya**. Siswa harus tahu bahwa guru pendamping melihat namanya *sebelum* menekan kirim. Laporan anonim yang dikirim sebelum migrasi 0005 tidak punya `user_id` dan tidak dapat dipulihkan — UI menampilkannya sebagai "Identitas tidak tersimpan".

## 7. Autentikasi & Manajemen Akun

- Registrasi/Login menggunakan email & password (+ opsi verifikasi email)
- Opsi login dengan Google (opsional, fase lanjut)
- Role-based access: `Siswa`, `Guru/Admin`, `Super Admin`
- Reset password via email
- Sesi login menggunakan JWT (access token + refresh token)

## 8. Kebutuhan Non-Fungsional

### 8.1 PWA (Progressive Web App)
- Dapat di-install ke home screen (Add to Home Screen) di Android/iOS/Desktop
- Web App Manifest (`manifest.json`) dengan ikon, nama, warna tema
- Service Worker untuk caching aset statis & offline fallback page
- Mendukung fitur *installable* sesuai kriteria PWA (Lighthouse PWA checklist)
- Responsive design (mobile-first, karena target utama adalah siswa yang banyak akses via HP)

### 8.2 Keamanan & Privasi
- Enkripsi data sensitif (refleksi jurnal, laporan) saat disimpan (encryption at rest)
- HTTPS wajib di semua endpoint
- Rate limiting pada endpoint Lapor & Auth untuk mencegah abuse
- Kepatuhan terhadap prinsip perlindungan data anak (mengingat target pengguna bisa di bawah umur)
- Audit log untuk aktivitas admin (tanpa membuka identitas pelapor anonim)

### 8.3 Performa
- Waktu load awal < 3 detik pada koneksi 4G
- Lighthouse Performance Score ≥ 85
- Lighthouse PWA Score ≥ 90

### 8.4 Aksesibilitas
- Kontras warna sesuai WCAG AA (penting karena tema warna cerah)
- Navigasi ramah keyboard & screen reader
- Ukuran font & tombol nyaman untuk pengguna remaja

## 9. Desain UI/UX

- **Warna utama:** Biru (primary), dikombinasikan dengan warna aksen cerah (misal kuning/hijau mint) untuk kesan hangat & positif
- **Gaya visual:** Cerah, elegan, bersih (clean), tidak kaku/kaku formal — cocok untuk audiens remaja namun tetap terpercaya
- **Navigasi utama:** Bottom navigation bar (mobile) dengan 4 ikon: Edukasi, Refleksi, Latihan, Lapor
- **Tone konten:** Suportif, tidak menghakimi, bahasa yang hangat dan mudah dipahami remaja
- Ilustrasi/ikon custom bertema keberanian & keamanan (perisai, tangan terbuka, dsb.) — hindari kesan "menakutkan"

## 10. Arsitektur & Tech Stack

| Layer | Teknologi |
|---|---|
| **Frontend** | Next.js (React) + PWA plugin (next-pwa / service worker manual) |
| **Backend** | Go (Golang) — REST API / gRPC |
| **Database** | PostgreSQL |
| **Autentikasi** | JWT (access & refresh token), bcrypt/argon2 untuk hash password |
| **File Storage** | Object storage (S3-compatible R2 CLOUDFLARE) untuk lampiran bukti laporan |
| **Hosting** | Frontend, Backend (Docker) di VPS |
| **Cache** | Redis (opsional, untuk rate limiting & session) |

### 10.1 Gambaran Modul Backend (Go)
- `auth-service`: registrasi, login, refresh token, role management
- `education-service`: CRUD materi, progress tracking
- `reflection-service`: CRUD jurnal refleksi (data terenkripsi, akses privat per user)
- `training-service`: skenario latihan, skor, progress
- `report-service`: submit laporan (mode identitas/anonim), tracking status, dashboard admin

### 10.2 Prinsip Desain Data
- Tabel `reports` memiliki kolom `user_id` **nullable** — null hanya untuk laporan anonim sebelum migrasi 0005; sesudahnya selalu terisi, dengan `anonymous` sebagai penanda mode (lihat revisi §6)
- Tabel terpisah `report_tickets` untuk pemetaan kode tiket ↔ laporan (tanpa menyimpan identitas)
- `report_tickets` tidak punya FK balik ke `users`: pelacakan status lewat kode tiket tidak menautkan identitas

## 11. Metrik Keberhasilan (KPI)

| Metrik | Target Awal |
|---|---|
| Jumlah pengguna terdaftar | 1.000 pengguna (3 bulan pertama) |
| Rasio penyelesaian modul edukasi | ≥ 40% pengguna menyelesaikan ≥1 modul |
| Jumlah laporan masuk yang ditindaklanjuti | ≥ 90% dalam 3x24 jam |
| PWA install rate | ≥ 20% dari pengguna aktif |
| Retensi pengguna (30 hari) | ≥ 25% |

## 12. Roadmap (Usulan)

| Fase | Fokus | Estimasi |
|---|---|---|
| **Fase 1 (MVP)** | Auth, 4 fitur utama (versi dasar), PWA setup | 6–8 minggu |
| **Fase 2** | Dashboard admin lengkap, notifikasi status laporan, gamifikasi edukasi | 4–6 minggu |
| **Fase 3** | Push notification, portal orang tua, analitik lanjutan | 4–6 minggu |

## 13. Risiko & Mitigasi

| Risiko | Mitigasi |
|---|---|
| Identitas pelapor anonim bocor ke sesama siswa | Identitas hanya ada di endpoint `/admin/*` yang role-gated; copy form lapor menyatakan batasnya apa adanya |
| Penyalahgunaan fitur lapor anonim (laporan palsu/spam) | Rate limiting, validasi konten, moderasi admin |
| Rendahnya engagement fitur edukasi/latihan | Gamifikasi, konten interaktif, notifikasi pengingat |
| Kepercayaan pengguna rendah terhadap tindak lanjut laporan | Transparansi status laporan (tracking tiket) |

## 14. Lampiran

- Wireframe/desain UI: *(link Figma — diisi kemudian)*
- Daftar materi edukasi awal: *(diisi tim konten)*
- Kebijakan privasi & syarat penggunaan: *(diisi tim legal)*

---

*Dokumen ini bersifat living document dan dapat diperbarui seiring perkembangan proyek.*
