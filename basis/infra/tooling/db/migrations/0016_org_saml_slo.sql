-- SAML Single Logout (IdP SLO URL) — F-ACC-07 Phase C.

ALTER TABLE org_saml_configs ADD COLUMN idp_slo_url TEXT;
ALTER TABLE org_saml_configs ADD COLUMN slo_enabled INTEGER NOT NULL DEFAULT 0;
