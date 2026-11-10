-- Gambar/video untuk skenario latihan: "amati gambar ini, lalu pilih responsmu".
--
-- Dua kolom, bukan satu JSONB atau markdown bebas seperti education_modules.body:
-- prompt skenario adalah satu situasi pendek, bukan artikel, jadi tidak ada
-- yang perlu diselipkan di antara paragraf. Satu media per skenario sudah cukup
-- dan menjaga markdown.ts tidak ikut dipakai di jalur ini.
--
-- media_url menyimpan URL penuh (sama seperti yang ditulis di body materi),
-- media_kind salah satu dari 'image' | 'video' | 'youtube'. Kosong = tidak ada
-- media, bukan NULL: kolom TEXT NOT NULL DEFAULT '' membuat Scan ke string Go
-- tidak perlu pointer di tiap handler.
ALTER TABLE training_scenarios
	ADD COLUMN IF NOT EXISTS media_url TEXT NOT NULL DEFAULT '',
	ADD COLUMN IF NOT EXISTS media_kind TEXT NOT NULL DEFAULT '';
