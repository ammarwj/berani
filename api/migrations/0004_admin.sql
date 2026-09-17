-- Arsip, bukan hapus: education_progress.module_id dan training_attempts.scenario_id
-- ON DELETE CASCADE, jadi DELETE satu materi ikut menghanguskan riwayat belajar
-- siswa yang sudah menyelesaikannya. Materi terarsip hilang dari daftar siswa,
-- barisan progresnya tetap utuh.
ALTER TABLE education_modules  ADD COLUMN published BOOLEAN NOT NULL DEFAULT TRUE;
ALTER TABLE training_scenarios ADD COLUMN published BOOLEAN NOT NULL DEFAULT TRUE;

-- Nonaktifkan, bukan hapus: users di-CASCADE ke refleksi, progres, dan
-- report_notes.author_id, jadi DELETE akun menghapus jejak audit tindak lanjut.
ALTER TABLE users ADD COLUMN name      TEXT    NOT NULL DEFAULT '';
ALTER TABLE users ADD COLUMN is_active BOOLEAN NOT NULL DEFAULT TRUE;

-- Baris tunggal: himpunan pengaturannya tetap dan diketahui, jadi kolom bertipe
-- memberi NOT NULL + default dari DB. Key/value akan memaksa semua nilai jadi
-- string; satu blob JSONB tidak bisa punya default per-field.
--
-- ponytail: tingkat urgensi sengaja TIDAK ikut di sini. reports.urgency punya
-- CHECK di 0001_init.sql, sort prioritas di report.AdminList, dan UrgencyBadge
-- adalah satu-satunya tempat danger-rose boleh dipakai (DESIGN.md). Naikkan
-- saat sekolah benar-benar butuh level ketiga: lepas CHECK, generalkan sort.
CREATE TABLE app_settings (
	id                INT PRIMARY KEY DEFAULT 1 CHECK (id = 1),
	school_name       TEXT NOT NULL DEFAULT 'Sekolahmu',
	bk_name           TEXT NOT NULL DEFAULT '',
	bk_phone          TEXT NOT NULL DEFAULT '',
	hotline_label     TEXT NOT NULL DEFAULT 'Darurat 119',
	hotline_phone     TEXT NOT NULL DEFAULT '119',
	anonymous_enabled BOOLEAN NOT NULL DEFAULT TRUE,
	-- Sama persis dengan CATEGORIES yang sebelumnya hardcode di web/app/lapor/page.tsx.
	-- `icon` harus salah satu nama di web/components/Icon.tsx — di luar itu tampil
	-- sebagai teks mentah, jadi editornya memakai <select>, bukan input teks.
	report_categories JSONB NOT NULL DEFAULT '[
		{"value":"verbal","icon":"record_voice_over","label":"Verbal","desc":"Ejekan, gosip, ancaman"},
		{"value":"fisik","icon":"front_hand","label":"Fisik","desc":"Dorongan, pukulan"},
		{"value":"cyber","icon":"devices","label":"Daring (Cyber)","desc":"Pesan kasar, spill medsos"},
		{"value":"sosial","icon":"group_off","label":"Sosial","desc":"Dikucilkan, dijauhi paksa"},
		{"value":"lainnya","icon":"chat_bubble","label":"Lainnya","desc":"Bentuk lain yang mengganggu"}
	]',
	updated_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

INSERT INTO app_settings (id) VALUES (1);
