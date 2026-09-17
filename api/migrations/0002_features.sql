-- Edukasi: quiz lives on the module as JSONB — [{question, options[], correct_index}]
ALTER TABLE education_modules ADD COLUMN quiz JSONB NOT NULL DEFAULT '[]';
ALTER TABLE education_modules ADD COLUMN summary TEXT NOT NULL DEFAULT '';
ALTER TABLE education_modules ADD COLUMN order_index INT NOT NULL DEFAULT 0;

ALTER TABLE education_progress ADD COLUMN quiz_score INT;
ALTER TABLE education_progress ADD COLUMN updated_at TIMESTAMPTZ NOT NULL DEFAULT now();

-- Latihan: options shaped as [{label, feedback, is_best}]
ALTER TABLE training_scenarios ADD COLUMN category TEXT NOT NULL DEFAULT 'umum';
ALTER TABLE training_scenarios ADD COLUMN order_index INT NOT NULL DEFAULT 0;
ALTER TABLE training_attempts ADD COLUMN chosen_index INT NOT NULL DEFAULT 0;

-- Refleksi: guided prompt shown when the entry was written, kept for context.
ALTER TABLE reflections ADD COLUMN prompt TEXT NOT NULL DEFAULT '';

-- Lapor: evidence attachments. object_key is random and carries no reporter identity,
-- so this table is safe to join for anonymous reports.
CREATE TABLE report_attachments (
	id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
	report_id UUID NOT NULL REFERENCES reports(id) ON DELETE CASCADE,
	object_key TEXT NOT NULL,
	filename TEXT NOT NULL,
	content_type TEXT NOT NULL,
	created_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

-- Admin follow-up notes, visible only to staff. Never references users(id) of the reporter.
CREATE TABLE report_notes (
	id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
	report_id UUID NOT NULL REFERENCES reports(id) ON DELETE CASCADE,
	author_id UUID NOT NULL REFERENCES users(id) ON DELETE CASCADE,
	note TEXT NOT NULL,
	status_after TEXT,
	created_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

ALTER TABLE reports ADD COLUMN involved TEXT NOT NULL DEFAULT '';

-- Auth: email verification + password reset. Tokens stored hashed so a DB leak
-- cannot be replayed to take over accounts.
ALTER TABLE users ADD COLUMN email_verified BOOLEAN NOT NULL DEFAULT FALSE;

CREATE TABLE auth_tokens (
	token_hash TEXT PRIMARY KEY,
	user_id UUID NOT NULL REFERENCES users(id) ON DELETE CASCADE,
	purpose TEXT NOT NULL CHECK (purpose IN ('verify_email', 'reset_password')),
	expires_at TIMESTAMPTZ NOT NULL,
	used_at TIMESTAMPTZ
);

CREATE INDEX idx_auth_tokens_user ON auth_tokens (user_id, purpose);
CREATE INDEX idx_reports_status ON reports (status, created_at DESC);
