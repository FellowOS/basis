# ADR 0006: Organization SAML 2.0 (F-ACC-07)

**Status:** accepted (2026-10)  
**Context:** [ADR 0002](0002-organization-tenant-sso.md) ships org-bound OIDC. Enterprise customers often require **SAML 2.0** SP-initiated login with metadata exchange.

## Decision

- Table **`org_saml_configs`** (one row per organization): IdP Entity ID, SSO URL, x509 cert, optional SP Entity ID override, email domains, `enabled`.
- **SP endpoints** (public):
  - `GET /api/v1/auth/saml/{org_slug}/metadata` — SP metadata XML for IdP admin
  - `GET /api/v1/auth/saml/{org_slug}/start` — redirect to IdP
  - `POST /api/v1/auth/saml/acs` — assertion consumer (HTTP-POST)
- **Admin API:** `GET|PUT /api/v1/orgs/{org_id}/saml` (org owner/admin).
- **Federated identity:** `user_federated_identities` with `provider=saml`, `issuer=idp_entity_id`, `subject=NameID`.
- **Runtime:** optional Python extra `uv sync --extra saml` (`python3-saml`). Without it, SAML routes return `503 saml_unavailable`; OIDC unchanged.
- **Login discovery:** `org-sso-options` / `org-sso-hint` include SAML with `protocol: "saml"`; domain match prefers OIDC when both exist.

## Out of scope (v1)

- IdP-initiated SSO, SLO, signed AuthnRequest, multiple SAML IdPs per org, automatic metadata fetch from IdP URL.

## Operations

1. Install SAML extra on API hosts: `uv sync --extra saml`.
2. Configure org SAML in **Settings → Organization SSO** (SAML card).
3. Give IdP admins **SP metadata URL** and **ACS URL** from the panel.
4. Map email domains for login hint (same as OIDC).
