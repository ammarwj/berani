ALTER TABLE reports DROP CONSTRAINT reports_urgency_check;
ALTER TABLE reports ADD CONSTRAINT reports_urgency_check
	CHECK (urgency IN ('sangat_mendesak', 'mendesak', 'tidak_mendesak'));
