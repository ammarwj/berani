-- Catatan tindak lanjut yang boleh dibaca pelapor.
--
-- Sampai sekarang report_notes seluruhnya internal (0002: "visible only to
-- staff"), dan siswa yang melacak tiketnya hanya melihat empat langkah status
-- tanpa penjelasan apa pun. Akibatnya guru BK tidak punya cara menyampaikan hal
-- sederhana seperti "datang ke ruang BK hari Kamis" selain memanggil siswa di
-- depan kelas — persis yang membuat pelapor terekspos ke pelaku.
--
-- DEFAULT FALSE, bukan TRUE: catatan yang sudah ada ditulis dengan asumsi tidak
-- akan pernah dibaca siswa, dan sebagiannya menyebut nama terlapor atau dugaan
-- yang belum terbukti. Membalik default-nya akan membuka semuanya sekaligus.
-- Visibilitas adalah tindakan sadar per catatan, bukan setelan yang diwarisi.
ALTER TABLE report_notes
	ADD COLUMN IF NOT EXISTS visible_to_reporter BOOLEAN NOT NULL DEFAULT FALSE;
