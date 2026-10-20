-- Platform-wide BOCP provider allowlist (KB policies must stay within this ceiling).

INSERT OR IGNORE INTO settings(key, value) VALUES ('connector_allowed_providers', '"*"');
