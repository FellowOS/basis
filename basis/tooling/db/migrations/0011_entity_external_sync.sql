-- Basis Open Connector Protocol (BOCP) & bidirectional entity sync (F-LAKE / F-OPS).

CREATE TABLE IF NOT EXISTS kb_connector_policies (
    kb_id TEXT PRIMARY KEY REFERENCES knowledge_bases(id) ON DELETE CASCADE,
    allowed_providers_json TEXT NOT NULL DEFAULT '"*"',
    action_policy_json TEXT NOT NULL DEFAULT '{}',
    updated_at TEXT NOT NULL
);

CREATE TABLE IF NOT EXISTS kb_connections (
    kb_id TEXT NOT NULL REFERENCES knowledge_bases(id) ON DELETE CASCADE,
    service TEXT NOT NULL,
    connection_name TEXT NOT NULL,
    auth_type TEXT NOT NULL,
    connection_config_json TEXT NOT NULL DEFAULT '{}',
    value_encrypted TEXT NOT NULL,
    account_profile_json TEXT NOT NULL DEFAULT '{}',
    revision INTEGER NOT NULL DEFAULT 1,
    updated_at TEXT NOT NULL,
    PRIMARY KEY (kb_id, service, connection_name)
);

CREATE TABLE IF NOT EXISTS kb_oauth_configs (
    kb_id TEXT NOT NULL REFERENCES knowledge_bases(id) ON DELETE CASCADE,
    service TEXT NOT NULL,
    value_encrypted TEXT NOT NULL,
    updated_at TEXT NOT NULL,
    PRIMARY KEY (kb_id, service)
);

CREATE TABLE IF NOT EXISTS kb_connector_runs (
    id TEXT PRIMARY KEY,
    kb_id TEXT NOT NULL REFERENCES knowledge_bases(id) ON DELETE CASCADE,
    service TEXT NOT NULL,
    operation_kind TEXT NOT NULL,
    target_id TEXT NOT NULL,
    connection_name TEXT NOT NULL DEFAULT 'default',
    started_at TEXT NOT NULL,
    completed_at TEXT NOT NULL,
    ok INTEGER NOT NULL,
    value_json TEXT NOT NULL
);

CREATE INDEX IF NOT EXISTS idx_kb_connector_runs_kb_started
    ON kb_connector_runs(kb_id, started_at DESC);

CREATE TABLE IF NOT EXISTS source_table_mappings (
    id TEXT PRIMARY KEY,
    kb_id TEXT NOT NULL REFERENCES knowledge_bases(id) ON DELETE CASCADE,
    source_id TEXT NOT NULL REFERENCES ingest_sources(id) ON DELETE CASCADE,
    stream_name TEXT NOT NULL,
    external_table TEXT NOT NULL,
    stream_params_json TEXT NOT NULL DEFAULT '{}',
    primary_key_column TEXT NOT NULL,
    cursor_column TEXT,
    label_column TEXT NOT NULL,
    target_class_uri TEXT NOT NULL,
    column_mappings_json TEXT NOT NULL,
    sync_mode TEXT NOT NULL DEFAULT 'incremental',
    track_deletes INTEGER NOT NULL DEFAULT 0 CHECK (track_deletes IN (0, 1)),
    checkpoint_json TEXT NOT NULL DEFAULT '{}',
    sync_direction TEXT NOT NULL DEFAULT 'inbound',
    writeback_mode TEXT NOT NULL DEFAULT 'review',
    max_rows INTEGER NOT NULL DEFAULT 10000,
    status TEXT NOT NULL DEFAULT 'active',
    created_at TEXT NOT NULL,
    updated_at TEXT NOT NULL,
    UNIQUE(kb_id, source_id, external_table)
);

CREATE INDEX IF NOT EXISTS idx_source_table_mappings_kb_source
    ON source_table_mappings(kb_id, source_id);

CREATE TABLE IF NOT EXISTS entity_external_refs (
    id TEXT PRIMARY KEY,
    kb_id TEXT NOT NULL REFERENCES knowledge_bases(id) ON DELETE CASCADE,
    entity_id TEXT NOT NULL REFERENCES entities(id) ON DELETE CASCADE,
    source_id TEXT NOT NULL REFERENCES ingest_sources(id) ON DELETE CASCADE,
    mapping_id TEXT NOT NULL REFERENCES source_table_mappings(id) ON DELETE CASCADE,
    external_table TEXT NOT NULL,
    external_pk TEXT NOT NULL,
    row_hash TEXT NOT NULL,
    last_synced_at TEXT NOT NULL,
    deleted_upstream_at TEXT,
    UNIQUE(kb_id, source_id, external_table, external_pk)
);

CREATE INDEX IF NOT EXISTS idx_entity_external_refs_entity
    ON entity_external_refs(kb_id, entity_id);

CREATE TABLE IF NOT EXISTS entity_sync_outbox (
    id TEXT PRIMARY KEY,
    kb_id TEXT NOT NULL REFERENCES knowledge_bases(id) ON DELETE CASCADE,
    entity_id TEXT NOT NULL REFERENCES entities(id) ON DELETE CASCADE,
    external_ref_id TEXT NOT NULL REFERENCES entity_external_refs(id) ON DELETE CASCADE,
    statement_id TEXT REFERENCES statements(id) ON DELETE SET NULL,
    typed_fact_id TEXT REFERENCES typed_facts(id) ON DELETE SET NULL,
    action_kind TEXT NOT NULL,
    patch_json TEXT NOT NULL,
    status TEXT NOT NULL,
    review_item_id TEXT REFERENCES review_items(id) ON DELETE SET NULL,
    decision_id TEXT REFERENCES agent_decisions(id) ON DELETE SET NULL,
    job_id TEXT REFERENCES jobs(id) ON DELETE SET NULL,
    error_code TEXT,
    error_detail_json TEXT,
    created_by TEXT REFERENCES users(id),
    created_at TEXT NOT NULL,
    synced_at TEXT
);

CREATE INDEX IF NOT EXISTS idx_entity_sync_outbox_kb_status
    ON entity_sync_outbox(kb_id, status, created_at);

