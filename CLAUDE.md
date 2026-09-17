# BERANI

Web app edukasi & pelaporan anti-bullying (PWA). **Baca [`PRD_BERANI.md`](PRD_BERANI.md) sebelum implementasi fitur baru** — dokumen ini hanya ringkasan operasional.

## Layout

```
web/      Next.js (App Router, TS, Tailwind) — PWA frontend
api/      Go — REST API
docker-compose.yml
```

## Stack

| Layer | Tech |
|---|---|
| Frontend | Next.js + manifest.json/service worker (PWA) |
| Backend | Go, stdlib `net/http`, `pgx/v5` |
| DB | PostgreSQL |
| Auth | JWT (`golang-jwt/jwt/v5`) + bcrypt |
| Storage | S3-compatible (Cloudflare R2) via `aws-sdk-go-v2` — lampiran laporan |
| Email | SMTP (`net/smtp`) — verifikasi email & reset password |

## Dev

```
cp api/.env.example api/.env   # wajib sekali di awal — compose gagal start tanpa file ini
docker compose up --build      # postgres + api + web
cd api && go run ./cmd/server  # api only, needs DATABASE_URL + REFLECTION_KEY
cd web && bun dev              # web only, needs NEXT_PUBLIC_API_URL
cd api && go test ./...        # crypto, rate limit, quiz grading

# akun demo (siswa/guru/admin, password berani123) — dev only, idempotent
docker compose exec -T postgres psql -U berani -d berani < api/seed/users.sql
```

Port bentrok? `WEB_PORT=3100 API_PORT=8081 docker compose up`. `APP_BASE_URL` (asal CORS) dan `NEXT_PUBLIC_API_URL` ikut menyesuaikan otomatis — jangan hardcode salah satunya saja, browser akan memblokir request.

Migrations run automatically on api startup (`api/migrations/*.sql`, tracked via `schema_migrations` table). `0003_seed_content.sql` seeds 5 modul edukasi + 4 skenario latihan.

### Env

Semua env dibaca dari `api/.env` (di-load otomatis oleh `internal/config/dotenv.go`, dan dipakai compose lewat `env_file`). Env var asli selalu menang atas isi file.

`REFLECTION_KEY` **wajib** — 64 hex chars (`openssl rand -hex 32`); server menolak start tanpa ini agar jurnal tidak tersimpan plaintext. Jangan beri nilai default di `docker-compose.yml`: `environment:` menimpa `env_file:`, jadi default akan diam-diam mengenkripsi jurnal dengan kunci yang diketahui publik.

R2 (`R2_*`) dan SMTP (`SMTP_*`) opsional: tanpa keduanya, lampiran dinonaktifkan dan email di-log, bukan dikirim. Lihat `api/.env.example`.

## v1.0 Implementation Checklist

- [x] **Infra** — docker-compose, migration runner, .env.example
- [x] **Auth** — register/login/refresh, verifikasi email, reset password (token hashed, sekali pakai), role-gated middleware
- [x] **Edukasi** — daftar & detail materi, kuis, progress tracking, badge
- [x] **Refleksi** — guided prompts, mood tracker, AES-256-GCM at rest, riwayat privat per user
- [x] **Latihan** — skenario pilihan ganda, feedback per pilihan, skor/progress
- [x] **Lapor** — form lengkap (lampiran R2, urgency, pihak terlibat), tracking tiket tanpa login, dashboard admin (list/filter/detail/update status)
- [x] **PWA** — manifest, service worker, offline fallback, bottom nav
- [x] **Rate limiting** — auth (10/menit) & lapor (5/10menit) per IP
- [x] **Admin CRUD materi** — CRUD materi & skenario (guru + admin), pengaturan sekolah & management user (super admin). Materi/user diarsipkan, tidak dihapus
- [ ] **Notifikasi status laporan** — pelapor harus cek tiket manual
- [ ] **Audit** — WCAG AA, Lighthouse PWA/perf ≥ 90/85

## Aturan yang tidak boleh dilanggar

**Anonimitas (PRD §6):** `reports.user_id` nullable, ticket code ada di tabel `report_tickets` terpisah tanpa FK balik ke `users`. Query admin tidak pernah `SELECT user_id` — hanya `user_id IS NULL AS is_anonymous`.

**Jawaban tidak pernah dikirim ke klien:** kunci kuis (`correct_index`) dan `is_best` skenario latihan di-strip di handler. Handler adminnya sengaja ada di dalam `package education`/`package training` supaya field kuncinya tetap unexported — kompiler yang menjamin package lain tidak bisa memarshalnya, bukan kedisiplinan. Penilaian server-side; klien tidak boleh mengirim skornya sendiri.

**Isi materi disimpan markdown, bukan HTML:** editornya TipTap (`components/RichTextEditor.tsx`), tapi yang disimpan hasil `toMarkdown(editor.getJSON())` — **jangan pakai `getHTML()`**. Begitu `body` berisi HTML, halaman siswa butuh `dangerouslySetInnerHTML` dan server butuh sanitizer HTML; konversi node→node tidak butuh keduanya. Tidak ada `dangerouslySetInnerHTML` di repo ini. Ekstensi StarterKit yang tidak bisa dirender `lib/markdown.ts` (blockquote, codeBlock, strike, underline, hr) **dimatikan di editor** — kalau tidak, pintasan keyboard dan paste tetap membuatnya lalu isinya hilang diam-diam saat disimpan.

**Arsip, bukan hapus:** tidak ada route DELETE untuk materi, skenario, maupun user. `education_progress`/`training_attempts`/refleksi semuanya `ON DELETE CASCADE`, jadi hapus = menghanguskan riwayat belajar dan jejak audit. Arsip = `PATCH {"published": false}`; nonaktif user = `PATCH {"is_active": false}`. Materi terarsip harus hilang dari **6 query** siswa — termasuk pembilang *dan* penyebut di `Progress`, kalau tidak `pct` bisa >100% dan badge tidak pernah tercapai.
