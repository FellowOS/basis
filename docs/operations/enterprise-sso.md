# Enterprise SSO (F-ACC-07) — production checklist

Operators configure **per-organization** OIDC or SAML under **System → Settings → Organization SSO**. Platform **Access** settings expose global OAuth callback URLs; org panels show org-specific login start URLs.

## Prerequisites

| Item | OIDC | SAML |
| --- | --- | --- |
| API dependency | Authlib (default `uv sync`) | `uv sync --extra saml` on every API host |
| Public URL | `BASIS_PUBLIC_URL` / platform **Site URL** must match what users and IdPs hit | Same |
| TLS | Production IdPs require HTTPS on API + web | Same |

## OIDC (recommended default)

1. Create an OAuth/OIDC app in your IdP (Okta, Azure AD, Google Workspace custom app, Keycloak, etc.).
2. **Redirect URI** (exact): `{PUBLIC_URL}/api/v1/auth/oidc/callback`  
   Shown in **Settings → Access → OAuth callbacks** and the org OIDC panel.
3. In **Organization SSO → OpenID Connect**: Issuer (well-known URL), Client ID, Client secret, scopes `openid email profile`, **email domains**, enable SSO.
4. **Sign-in policy**: `password_allowed` (pilot) → `sso_preferred` → `sso_required` when ready.
5. Smoke test: `GET /api/v1/auth/org-sso-hint?email=user@yourdomain.com` → `login_url`; open **Login** → org SSO button or email hint.
6. E2E reference: `web/e2e/org-sso-login.spec.ts` (mock issuer URL; swap for staging IdP in manual QA).

### Azure AD (OIDC) notes

- Issuer: `https://login.microsoftonline.com/{tenant-id}/v2.0`
- Redirect URI: web platform type, single-page not required for server-side callback.
- ID token must include `email` or `preferred_username` for JIT provisioning.

### Okta (OIDC) notes

- Issuer: `https://{yourOktaDomain}/oauth2/default` (or custom authorization server).
- Assign users/groups to the app before testing.

## SAML 2.0

See [ADR 0006](../architecture/0006-org-saml.md).

1. Install `uv sync --extra saml` and restart API.
2. **Organization SSO → SAML 2.0**: IdP Entity ID, IdP SSO URL, IdP signing certificate (PEM).
3. Give IdP admins:
   - **SP metadata URL**: `{PUBLIC_URL}/api/v1/auth/saml/{org_slug}/metadata`
   - **ACS URL**: `{PUBLIC_URL}/api/v1/auth/saml/acs` (HTTP-POST)  
   Also listed under **Settings → Access → OAuth callbacks** as **Organization SAML ACS**.
4. Map IdP attribute / NameID to email (Basis uses NameID or `email` / `mail` attributes for account linking).
5. Smoke test: `GET /api/v1/auth/saml/{org_slug}/start` → redirect to IdP; complete login → redirect to web with `basis_token`.
6. **Signed AuthnRequest** (Azure AD and others): enable **Sign AuthnRequest** in the SAML panel; paste SP cert + private key (upload cert to IdP); SP metadata reflects signing when `uv sync --extra saml` is active.

### Common IdP field names

| IdP | Entity ID | SSO URL | Cert |
| --- | --- | --- | --- |
| Okta | Metadata URL or issuer | Single sign-on URL | Signing certificate |
| Azure AD | Identifier (Entity ID) | Login URL | Certificate (base64) |
| Keycloak | Entity descriptor entityID | Redirect SSO URL | Realm keys → signing |

## Sign-off criteria (production)

- [ ] `BASIS_PUBLIC_URL` matches browser and IdP redirect configuration.
- [ ] Email domain on org SSO config matches corporate mailbox domain used in QA.
- [ ] Forced SSO (`sso_required`) tested: password and magic link blocked for that domain (`assert_local_login_allowed`).
- [ ] Federated user can open KB after login; org member / KB member roles verified.
- [ ] Audit: platform **Audit** shows `auth.login` with `provider` `oidc` or `saml`.
- [ ] Rollback: disable org SSO (`enabled: false`) or revert `auth_policy` without DB migration.

## Out of scope (track in progress.md)

- Local Logto compose sign-off (`docker/logto/`) — deferred.
- SAML signed AuthnRequest, SLO, IdP-initiated SSO.
- Multiple IdPs per organization.
