-- Akun demo untuk development. SENGAJA tidak diletakkan di migrations/:
-- migration jalan otomatis saat api start, dan akun dengan password yang
-- diketahui publik tidak boleh ikut ter-apply di production.
--
--   docker compose exec -T postgres psql -U berani -d berani < api/seed/users.sql
--
-- Password semua akun: berani123
-- crypt()/gen_salt('bf', 10) dari pgcrypto menghasilkan hash $2a$ yang
-- kompatibel dengan bcrypt.DefaultCost di internal/auth/handlers.go.

INSERT INTO users (email, password_hash, role, email_verified) VALUES
	('siswa@berani.test',      crypt('berani123', gen_salt('bf', 10)), 'siswa',       TRUE),
	('siswa2@berani.test',     crypt('berani123', gen_salt('bf', 10)), 'siswa',       TRUE),
	('belum-verif@berani.test',crypt('berani123', gen_salt('bf', 10)), 'siswa',       FALSE),
	('guru@berani.test',       crypt('berani123', gen_salt('bf', 10)), 'guru_admin',  TRUE),
	('admin@berani.test',      crypt('berani123', gen_salt('bf', 10)), 'super_admin', TRUE)
ON CONFLICT (email) DO NOTHING;

SELECT email, role, email_verified FROM users WHERE email LIKE '%@berani.test' ORDER BY role, email;
