-- Canonical knowledge ledger and projection metadata (ADR 0001).

CREATE TABLE IF NOT EXISTS ingest_sources (
    id TEXT PRIMARY KEY,
    kb_id TEXT NOT NULL REFERENCES knowledge_bases(id),
    kind TEXT NOT NULL,
    name TEXT NOT NULL,
    config_json TEXT NOT NULL,
    secret_ref TEXT,
    enabled INTEGER NOT NULL DEFAULT 1 CHECK (enabled IN (0, 1)),
    created_by TEXT NOT NULL REFERENCES users(id),
    created_at TEXT NOT NULL,
    updated_at TEXT NOT NULL,
    deleted_at TEXT
);

CREATE TABLE IF NOT EXISTS documents (
    id TEXT PRIMARY KEY,
    kb_id TEXT NOT NULL REFERENCES knowledge_bases(id),
    source_id TEXT REFERENCES ingest_sources(id),
    external_key TEXT,
    title TEXT NOT NULL,
    mime_type TEXT NOT NULL,
    current_version_id TEXT,
    created_by TEXT REFERENCES users(id),
    created_at TEXT NOT NULL,
    deleted_at TEXT
);

CREATE UNIQUE INDEX IF NOT EXISTS documents_source_key_active
    ON documents(kb_id, source_id, external_key)
    WHERE external_key IS NOT NULL AND deleted_at IS NULL;

CREATE TABLE IF NOT EXISTS document_versions (
    id TEXT PRIMARY KEY,
    kb_id TEXT NOT NULL REFERENCES knowledge_bases(id),
    document_id TEXT NOT NULL REFERENCES documents(id),
    version_no INTEGER NOT NULL,
    sha256 TEXT NOT NULL,
    blob_key TEXT NOT NULL,
    byte_size INTEGER NOT NULL CHECK (byte_size >= 0),
    source_time TEXT,
    source_time_kind TEXT,
    status TEXT NOT NULL,
    error_code TEXT,
    error_detail_json TEXT,
    created_at TEXT NOT NULL,
    ready_at TEXT,
    UNIQUE(document_id, version_no)
);

CREATE TABLE IF NOT EXISTS chunks (
    id TEXT PRIMARY KEY,
    kb_id TEXT NOT NULL REFERENCES knowledge_bases(id),
    version_id TEXT NOT NULL REFERENCES document_versions(id),
    ordinal INTEGER NOT NULL,
    text TEXT NOT NULL,
    heading TEXT,
    char_start INTEGER,
    char_end INTEGER,
    token_count INTEGER,
    language TEXT,
    origin TEXT NOT NULL DEFAULT 'stated',
    anchor_json TEXT,
    created_at TEXT NOT NULL,
    UNIQUE(version_id, ordinal)
);

CREATE TABLE IF NOT EXISTS extraction_drops (
    id TEXT PRIMARY KEY,
    kb_id TEXT NOT NULL REFERENCES knowledge_bases(id),
    version_id TEXT NOT NULL REFERENCES document_versions(id),
    chunk_id TEXT REFERENCES chunks(id),
    code TEXT NOT NULL,
    severity TEXT NOT NULL DEFAULT 'drop',
    detail_json TEXT NOT NULL,
    created_at TEXT NOT NULL
);

CREATE TABLE IF NOT EXISTS entities (
    id TEXT PRIMARY KEY,
    kb_id TEXT NOT NULL REFERENCES knowledge_bases(id),
    canonical_label TEXT,
    description TEXT,
    entity_kind TEXT NOT NULL DEFAULT 'named',
    created_at TEXT NOT NULL,
    invalidated_at TEXT
);

CREATE TABLE IF NOT EXISTS entity_names (
    id TEXT PRIMARY KEY,
    kb_id TEXT NOT NULL REFERENCES knowledge_bases(id),
    entity_id TEXT NOT NULL REFERENCES entities(id),
    value TEXT NOT NULL,
    normalized_value TEXT NOT NULL,
    language TEXT,
    evidence_id TEXT,
    recorded_at TEXT NOT NULL,
    invalidated_at TEXT
);

CREATE INDEX IF NOT EXISTS entity_names_lookup
    ON entity_names(kb_id, normalized_value)
    WHERE invalidated_at IS NULL;

CREATE TABLE IF NOT EXISTS statements (
    id TEXT PRIMARY KEY,
    kb_id TEXT NOT NULL REFERENCES knowledge_bases(id),
    subject_id TEXT NOT NULL REFERENCES entities(id),
    surface_phrase TEXT NOT NULL,
    object_entity_id TEXT REFERENCES entities(id),
    object_value TEXT,
    object_datatype TEXT,
    confidence REAL,
    status TEXT NOT NULL,
    proposed_by TEXT NOT NULL,
    recorded_at TEXT NOT NULL,
    invalidated_at TEXT,
    supersedes_id TEXT REFERENCES statements(id),
    CHECK ((object_entity_id IS NULL) <> (object_value IS NULL))
);

CREATE TABLE IF NOT EXISTS statement_evidence (
    id TEXT PRIMARY KEY,
    kb_id TEXT NOT NULL REFERENCES knowledge_bases(id),
    statement_id TEXT NOT NULL REFERENCES statements(id),
    chunk_id TEXT NOT NULL REFERENCES chunks(id),
    quote TEXT NOT NULL,
    quote_start INTEGER,
    quote_end INTEGER,
    created_at TEXT NOT NULL,
    UNIQUE(statement_id, chunk_id, quote_start, quote_end)
);

CREATE TABLE IF NOT EXISTS statement_qualifiers (
    id TEXT PRIMARY KEY,
    kb_id TEXT NOT NULL REFERENCES knowledge_bases(id),
    statement_id TEXT NOT NULL REFERENCES statements(id),
    role TEXT NOT NULL,
    value TEXT,
    entity_id TEXT REFERENCES entities(id),
    CHECK ((entity_id IS NULL) <> (value IS NULL))
);

CREATE TABLE IF NOT EXISTS time_mentions (
    id TEXT PRIMARY KEY,
    kb_id TEXT NOT NULL REFERENCES knowledge_bases(id),
    statement_id TEXT NOT NULL REFERENCES statements(id),
    chunk_id TEXT NOT NULL REFERENCES chunks(id),
    text TEXT NOT NULL,
    char_start INTEGER NOT NULL,
    char_end INTEGER NOT NULL
);

CREATE TABLE IF NOT EXISTS mappings (
    id TEXT PRIMARY KEY,
    kb_id TEXT NOT NULL REFERENCES knowledge_bases(id),
    signature TEXT NOT NULL,
    target_uri TEXT,
    target_kind TEXT NOT NULL,
    direction TEXT NOT NULL,
    status TEXT NOT NULL,
    actor_id TEXT REFERENCES users(id),
    why TEXT,
    created_at TEXT NOT NULL,
    invalidated_at TEXT,
    supersedes_id TEXT REFERENCES mappings(id)
);

CREATE UNIQUE INDEX IF NOT EXISTS mapping_active_signature
    ON mappings(kb_id, signature)
    WHERE status = 'confirmed' AND invalidated_at IS NULL;

CREATE TABLE IF NOT EXISTS typed_facts (
    id TEXT PRIMARY KEY,
    kb_id TEXT NOT NULL REFERENCES knowledge_bases(id),
    subject_id TEXT NOT NULL REFERENCES entities(id),
    predicate_uri TEXT NOT NULL,
    object_entity_id TEXT REFERENCES entities(id),
    object_value TEXT,
    object_datatype TEXT,
    from_statement_id TEXT REFERENCES statements(id),
    mapping_id TEXT REFERENCES mappings(id),
    import_provenance_json TEXT,
    confidence REAL,
    valid_from TEXT,
    valid_to TEXT,
    recorded_at TEXT NOT NULL,
    invalidated_at TEXT,
    supersedes_id TEXT REFERENCES typed_facts(id),
    CHECK ((object_entity_id IS NULL) <> (object_value IS NULL)),
    CHECK (from_statement_id IS NOT NULL OR import_provenance_json IS NOT NULL)
);

CREATE TABLE IF NOT EXISTS derived_facts (
    id TEXT PRIMARY KEY,
    kb_id TEXT NOT NULL REFERENCES knowledge_bases(id),
    subject_id TEXT NOT NULL REFERENCES entities(id),
    predicate_uri TEXT NOT NULL,
    object_entity_id TEXT REFERENCES entities(id),
    object_value TEXT,
    object_datatype TEXT,
    rule_id TEXT,
    recorded_at TEXT NOT NULL,
    invalidated_at TEXT,
    CHECK ((object_entity_id IS NULL) <> (object_value IS NULL))
);

CREATE TABLE IF NOT EXISTS fact_derivations (
    derived_fact_id TEXT NOT NULL REFERENCES derived_facts(id),
    premise_kind TEXT NOT NULL,
    premise_id TEXT NOT NULL,
    ordinal INTEGER NOT NULL,
    PRIMARY KEY (derived_fact_id, ordinal)
);

CREATE TABLE IF NOT EXISTS review_items (
    id TEXT PRIMARY KEY,
    kb_id TEXT NOT NULL REFERENCES knowledge_bases(id),
    kind TEXT NOT NULL,
    subject_type TEXT NOT NULL,
    subject_id TEXT NOT NULL,
    status TEXT NOT NULL DEFAULT 'open',
    priority INTEGER NOT NULL DEFAULT 0,
    payload_json TEXT NOT NULL,
    version INTEGER NOT NULL DEFAULT 1,
    created_at TEXT NOT NULL,
    resolved_at TEXT,
    resolved_by TEXT REFERENCES users(id),
    rationale TEXT
);

CREATE UNIQUE INDEX IF NOT EXISTS review_one_open_subject
    ON review_items(kb_id, kind, subject_type, subject_id)
    WHERE status = 'open';

CREATE TABLE IF NOT EXISTS agent_decisions (
    id TEXT PRIMARY KEY,
    kb_id TEXT NOT NULL REFERENCES knowledge_bases(id),
    review_item_id TEXT REFERENCES review_items(id),
    action TEXT NOT NULL,
    status TEXT NOT NULL,
    confidence REAL,
    rationale TEXT,
    trace_json TEXT NOT NULL,
    model_ref TEXT,
    created_at TEXT NOT NULL,
    applied_at TEXT,
    supersedes_id TEXT REFERENCES agent_decisions(id)
);

CREATE TABLE IF NOT EXISTS entity_merges (
    id TEXT PRIMARY KEY,
    kb_id TEXT NOT NULL REFERENCES knowledge_bases(id),
    source_entity_id TEXT NOT NULL REFERENCES entities(id),
    target_entity_id TEXT NOT NULL REFERENCES entities(id),
    decision_id TEXT REFERENCES agent_decisions(id),
    actor_id TEXT REFERENCES users(id),
    why TEXT,
    created_at TEXT NOT NULL,
    reverted_at TEXT,
    reverted_by TEXT REFERENCES users(id)
);

CREATE TABLE IF NOT EXISTS jobs (
    id TEXT PRIMARY KEY,
    kb_id TEXT NOT NULL REFERENCES knowledge_bases(id),
    kind TEXT NOT NULL,
    subject_type TEXT,
    subject_id TEXT,
    status TEXT NOT NULL,
    attempt INTEGER NOT NULL DEFAULT 1,
    progress REAL,
    error_code TEXT,
    error_detail_json TEXT,
    idempotency_key TEXT,
    created_at TEXT NOT NULL,
    started_at TEXT,
    finished_at TEXT,
    UNIQUE(kb_id, kind, idempotency_key)
);

CREATE TABLE IF NOT EXISTS embedding_records (
    id TEXT PRIMARY KEY,
    kb_id TEXT NOT NULL REFERENCES knowledge_bases(id),
    chunk_id TEXT NOT NULL REFERENCES chunks(id),
    model_ref TEXT NOT NULL,
    dimension INTEGER NOT NULL,
    content_sha256 TEXT NOT NULL,
    vector_key TEXT NOT NULL,
    created_at TEXT NOT NULL,
    UNIQUE(chunk_id, model_ref)
);

CREATE TABLE IF NOT EXISTS chat_sessions (
    id TEXT PRIMARY KEY,
    kb_id TEXT NOT NULL REFERENCES knowledge_bases(id),
    user_id TEXT NOT NULL REFERENCES users(id),
    title TEXT,
    created_at TEXT NOT NULL,
    updated_at TEXT NOT NULL,
    deleted_at TEXT
);

CREATE TABLE IF NOT EXISTS chat_messages (
    id TEXT PRIMARY KEY,
    kb_id TEXT NOT NULL REFERENCES knowledge_bases(id),
    session_id TEXT NOT NULL REFERENCES chat_sessions(id),
    role TEXT NOT NULL,
    content TEXT NOT NULL,
    status TEXT NOT NULL,
    generation_id TEXT,
    error_code TEXT,
    created_at TEXT NOT NULL,
    completed_at TEXT
);

CREATE TABLE IF NOT EXISTS chat_citations (
    message_id TEXT NOT NULL REFERENCES chat_messages(id),
    ordinal INTEGER NOT NULL,
    chunk_id TEXT REFERENCES chunks(id),
    evidence_id TEXT REFERENCES statement_evidence(id),
    quote TEXT,
    PRIMARY KEY (message_id, ordinal)
);

CREATE TABLE IF NOT EXISTS projection_state (
    kb_id TEXT PRIMARY KEY REFERENCES knowledge_bases(id),
    revision INTEGER NOT NULL DEFAULT 0,
    schema_version INTEGER NOT NULL,
    status TEXT NOT NULL,
    last_built_at TEXT,
    last_error_code TEXT
);

CREATE TABLE IF NOT EXISTS api_tokens (
    id TEXT PRIMARY KEY,
    token_hash TEXT NOT NULL UNIQUE,
    user_id TEXT NOT NULL REFERENCES users(id),
    name TEXT NOT NULL,
    scope TEXT NOT NULL,
    kb_ids_json TEXT NOT NULL,
    created_at TEXT NOT NULL,
    expires_at TEXT,
    last_used_at TEXT,
    revoked_at TEXT
);
