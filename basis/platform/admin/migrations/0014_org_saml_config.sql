-- Organization SAML 2.0 IdP config (F-ACC-07).

CREATE TABLE IF NOT EXISTS org_saml_configs (
    organization_id TEXT PRIMARY KEY REFERENCES organizations(id) ON DELETE CASCADE,
    idp_entity_id TEXT NOT NULL,
    idp_sso_url TEXT NOT NULL,
    idp_x509_cert TEXT NOT NULL,
    sp_entity_id TEXT,
    email_domains_json TEXT NOT NULL DEFAULT '[]',
    enabled INTEGER NOT NULL DEFAULT 1,
    created_at TEXT NOT NULL,
    updated_at TEXT NOT NULL
);
