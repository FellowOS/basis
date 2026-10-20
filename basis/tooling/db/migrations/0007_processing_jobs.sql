ALTER TABLE jobs ADD COLUMN options_json TEXT;
ALTER TABLE jobs ADD COLUMN result_json TEXT;

CREATE INDEX IF NOT EXISTS jobs_kb_created
    ON jobs(kb_id, created_at DESC);

CREATE UNIQUE INDEX IF NOT EXISTS jobs_active_document_version
    ON jobs(kb_id, subject_type, subject_id)
    WHERE kind = 'ingest' AND status IN ('queued', 'running');
