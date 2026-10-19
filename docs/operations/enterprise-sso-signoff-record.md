# Enterprise SSO sign-off record (F-ACC-07)

Copy this page per customer environment after completing [enterprise-sso.md](enterprise-sso.md). Store the filled copy in your internal runbook (not in git if it names tenants).

## Environment

| Field | Value |
| --- | --- |
| Customer / tenant | |
| Basis deployment URL (`BASIS_PUBLIC_URL`) | |
| Web origin | |
| Sign-off date | |
| Engineer | |

## Protocol

| | OIDC | SAML 2.0 |
| --- | --- | --- |
| Used for this org | ☐ | ☐ |
| IdP product (Okta / Azure AD / Keycloak / …) | | |
| Org slug | | |
| Email domains on org SSO config | | |
| `auth_policy` at sign-off | `password_allowed` / `sso_preferred` / `sso_required` | same |

## Configuration verified

| Check | OIDC | SAML | Notes |
| --- | --- | --- | --- |
| Redirect / ACS URL matches **Settings → Access** | ☐ | ☐ | |
| SP metadata fetched (SAML) | — | ☐ | |
| Signed AuthnRequest (if required) | — | ☐ | |
| SLO enabled + IdP SLO URL (if required) | — | ☐ | |
| `uv sync --extra saml` on API hosts (SAML) | — | ☐ | |

## Functional tests

| Test | Pass | Evidence |
| --- | --- | --- |
| `GET /api/v1/auth/org-sso-hint?email={corp}` returns `login_url` | ☐ | |
| Login via org SSO button or hint | ☐ | |
| KB opens; org/KB roles correct | ☐ | |
| `sso_required`: password + magic link blocked for domain | ☐ | |
| Audit shows `auth.login` with `provider` `oidc` or `saml` | ☐ | |
| Logout (SAML + SLO): console logout redirects to IdP when configured | ☐ | |
| Rollback: disable org SSO without migration | ☐ | |

## Automation

```bash
BASIS_PUBLIC_URL=https://your-api.example uv run python scripts/enterprise_sso_smoke.py
```

## Sign-off

| Role | Name | Approval |
| --- | --- | --- |
| Basis operator | | ☐ |
| Customer IdP admin | | ☐ |
