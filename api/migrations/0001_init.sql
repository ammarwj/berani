CREATE EXTENSION IF NOT EXISTS pgcrypto;

CREATE TABLE users (
	id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
	email TEXT UNIQUE NOT NULL,
	password_hash TEXT NOT NULL,
	role TEXT NOT NULL DEFAULT 'siswa' CHECK (role IN ('siswa', 'guru_admin', 'super_admin')),
	created_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

-- Edukasi
CREATE TABLE education_modules (
	id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
	title TEXT NOT NULL,
	category TEXT NOT NULL,
	content_type TEXT NOT NULL CHECK (content_type IN ('article', 'video', 'infographic')),
	body TEXT NOT NULL,
	created_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

CREATE TABLE education_progress (
	user_id UUID NOT NULL REFERENCES users(id) ON DELETE CASCADE,
	module_id UUID NOT NULL REFERENCES education_modules(id) ON DELETE CASCADE,
	completed_at TIMESTAMPTZ,
	PRIMARY KEY (user_id, module_id)
);

-- Refleksi (private per user, content encrypted at application layer)
CREATE TABLE reflections (
	id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
	user_id UUID NOT NULL REFERENCES users(id) ON DELETE CASCADE,
	mood TEXT NOT NULL,
	content_encrypted TEXT NOT NULL,
	created_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

-- Latihan
CREATE TABLE training_scenarios (
	id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
	prompt TEXT NOT NULL,
	options JSONB NOT NULL,
	created_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

CREATE TABLE training_attempts (
	id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
	user_id UUID NOT NULL REFERENCES users(id) ON DELETE CASCADE,
	scenario_id UUID NOT NULL REFERENCES training_scenarios(id) ON DELETE CASCADE,
	score INT NOT NULL,
	created_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

-- Lapor: user_id nullable for anonymity; no FK path from report_tickets back to users.
CREATE TABLE reports (
	id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
	user_id UUID REFERENCES users(id) ON DELETE SET NULL,
	category TEXT NOT NULL,
	description TEXT NOT NULL,
	location TEXT NOT NULL DEFAULT '',
	occurred_at TIMESTAMPTZ,
	urgency TEXT NOT NULL DEFAULT 'tidak_mendesak' CHECK (urgency IN ('mendesak', 'tidak_mendesak')),
	status TEXT NOT NULL DEFAULT 'diterima' CHECK (status IN ('diterima', 'diproses', 'ditindaklanjuti', 'selesai')),
	created_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

CREATE TABLE report_tickets (
	id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
	report_id UUID NOT NULL REFERENCES reports(id) ON DELETE CASCADE,
	ticket_code TEXT UNIQUE NOT NULL
);
