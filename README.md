# BERANI

**B**elajar, **E**dukasi, & **A**man Terhadap Bullying — web app edukasi dan pelaporan anti-bullying (PWA), untuk siswa, guru/BK, dan admin sekolah.

Lihat [`PRD_BERANI.md`](PRD_BERANI.md) untuk latar belakang produk, fitur, dan requirement lengkap. [`CLAUDE.md`](CLAUDE.md) berisi ringkasan operasional dan aturan implementasi yang tidak boleh dilanggar.

## Fitur Utama

- 🎓 **Edukasi** — materi, kuis, progress tracking, badge
- 🪞 **Refleksi** — jurnal privat terenkripsi (AES-256-GCM), mood tracker
- 💪 **Latihan** — skenario pilihan ganda dengan feedback & skor
- 🚨 **Lapor** — pelaporan bullying dengan opsi anonim, tracking tiket tanpa login, dashboard admin

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

## Menjalankan Secara Lokal

```bash
cp api/.env.example api/.env   # wajib sekali di awal — compose gagal start tanpa file ini
docker compose up --build      # postgres + api + web
```

`REFLECTION_KEY` di `api/.env` **wajib** diisi (64 hex chars, `openssl rand -hex 32`) — server menolak start tanpa ini agar jurnal refleksi tidak tersimpan plaintext.

R2 (`R2_*`) dan SMTP (`SMTP_*`) opsional: tanpa keduanya, lampiran laporan dinonaktifkan dan email di-log, bukan dikirim.

Port bentrok? Jalankan dengan override:

```bash
WEB_PORT=3100 API_PORT=8081 docker compose up
```

### Development terpisah

```bash
cd api && go run ./cmd/server   # butuh DATABASE_URL + REFLECTION_KEY
cd web && bun dev               # butuh NEXT_PUBLIC_API_URL
cd api && go test ./...         # crypto, rate limit, quiz grading
```

Migration berjalan otomatis saat api start (`api/migrations/*.sql`).

### Akun demo (dev only)

```bash
docker compose exec -T postgres psql -U berani -d berani < api/seed/users.sql
```

Siswa/guru/admin, password `berani123`.

## Status Implementasi

Lihat checklist di [`CLAUDE.md`](CLAUDE.md#v10-implementation-checklist). Ringkas: Auth, Edukasi, Refleksi, Latihan, Lapor, PWA, rate limiting, dan admin CRUD materi sudah selesai. Notifikasi status laporan dan audit aksesibilitas/performa masih tersisa untuk v1.0.
