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

## AuthnRequest signing (Phase B)

- Columns `authn_requests_signed`, `sp_x509_cert`, `sp_private_key` on `org_saml_configs`.
- When enabled, python3-saml sets `security.authnRequestsSigned` and embeds SP cert/key in metadata/login.
- Private key is stored server-side (same trust model as OIDC `client_secret`); never returned on `GET`.

## Single logout (Phase C)

- Columns `idp_slo_url`, `slo_enabled` on `org_saml_configs`.
- **SP SLO URL** (shared): `GET|POST /api/v1/auth/saml/slo` (Redirect/POST bindings).
- **SP-initiated logout:** `GET /api/v1/auth/saml/{org_slug}/logout?name_id=…&session_index=…` → IdP → return to `/saml/slo` with signed `RelayState` (`org_id`).
- SP metadata includes `singleLogoutService` when SLO is enabled and IdP SLO URL is set.

## Out of scope (still)

- IdP-initiated SSO/login, IdP-initiated SLO without RelayState, multiple SAML IdPs per org, automatic metadata fetch from IdP URL.

## Operations

1. Install SAML extra on API hosts: `uv sync --extra saml`.
2. Configure org SAML in **Settings → Organization SSO** (SAML card).
3. Give IdP admins **SP metadata URL** and **ACS URL** from the panel.
4. Map email domains for login hint (same as OIDC).
