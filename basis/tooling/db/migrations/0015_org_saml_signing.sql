-- Optional SP signing for SAML AuthnRequest (F-ACC-07).

ALTER TABLE org_saml_configs ADD COLUMN authn_requests_signed INTEGER NOT NULL DEFAULT 0;
ALTER TABLE org_saml_configs ADD COLUMN sp_x509_cert TEXT;
ALTER TABLE org_saml_configs ADD COLUMN sp_private_key TEXT;
