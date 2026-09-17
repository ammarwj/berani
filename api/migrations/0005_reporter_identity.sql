-- Guru pendamping perlu tahu siapa yang melapor untuk bisa menindaklanjuti:
-- menghubungi wali kelas, memisahkan siswa, memanggil orang tua. Mode anonim
-- karena itu berubah arti — dari "identitas tidak pernah disimpan" menjadi
-- "identitas tidak ditampilkan ke siapa pun selain guru pendamping".
--
-- reports.user_id tetap nullable: laporan lama yang dikirim anonim memang tidak
-- pernah menyimpan identitasnya dan tidak bisa dipulihkan. Barisan itu di-backfill
-- anonymous = TRUE dengan user_id NULL, dan UI menampilkannya sebagai
-- "identitas tidak tersimpan" — beda dari laporan anonim baru yang punya pelapor.
ALTER TABLE reports ADD COLUMN anonymous BOOLEAN NOT NULL DEFAULT FALSE;

UPDATE reports SET anonymous = TRUE WHERE user_id IS NULL;
