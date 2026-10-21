CREATE TABLE IF NOT EXISTS kb_reasoning_rules (
    id TEXT PRIMARY KEY,
    kb_id TEXT NOT NULL REFERENCES knowledge_bases(id),
    name TEXT NOT NULL,
    body TEXT NOT NULL,
    enabled INTEGER NOT NULL DEFAULT 1,
    actor_id TEXT REFERENCES users(id),
    created_at TEXT NOT NULL,
    updated_at TEXT NOT NULL,
    deleted_at TEXT
);

CREATE INDEX IF NOT EXISTS kb_reasoning_rules_kb_active
    ON kb_reasoning_rules(kb_id, updated_at DESC)
    WHERE deleted_at IS NULL;
