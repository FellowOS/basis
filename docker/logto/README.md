# Logto (local OIDC IdP for Basis dev)

> **Status:** optional local stack; **not required** for day-to-day dev (use E2E mock IdP or any OIDC provider when you need manual SSO). Team may defer Logto sign-off until production IdP work.

[Logto](https://github.com/logto-io/logto) is an **organization OIDC** IdP option for local Basis dev (same `org_oidc_configs` + `/api/v1/auth/oidc/*` flow).

## Start Logto

```bash
cd docker/logto
cp .env.example .env
docker compose -f compose.yml up -d
```

- **Admin Console**: `http://localhost:3002` — create the admin user on first visit.
- **OIDC issuer base** (API): `http://localhost:3001` → Issuer URL for Basis: **`http://localhost:3001/oidc`** (trailing slash optional; Basis normalizes).

Verify discovery:

```bash
curl -sS http://localhost:3001/oidc/.well-known/openid-configuration | head
```

## Basis (Server)

```bash
export BASIS_DATABASE_URL=postgresql://basis:basis@127.0.0.1:5432/basis  # or SQLite
export BASIS_HOST=127.0.0.1
export BASIS_PORT=8090
uv run basis serve
```

```bash
cd web && npm run dev
```

1. **系统 → 系统设置 → 访问与认证**：**站点 URL** = `http://127.0.0.1:8090`.
2. **组织 SSO**：enable SSO, set **email domains** (e.g. `yeah.net`), paste Logto values below.

**Redirect URI** (Logto app + Basis panel):

`http://127.0.0.1:8090/api/v1/auth/oidc/callback`

## Application in Logto

1. Admin Console → **Applications** → **Create application**.
2. Type: **Traditional web** (confidential client with secret).
3. **Redirect URIs**: `http://127.0.0.1:8090/api/v1/auth/oidc/callback`
4. Copy **App ID** → Basis **Client ID**; **App secret** → **Client secret**.
5. Basis org SSO **Issuer**: `http://localhost:3001/oidc`
6. **Scopes**: `openid email profile`
7. **Auth policy** on Basis: `sso_preferred` or `sso_required` as needed.

Sign-in / sign-up UI is configured under **Sign-in experience** in Logto (registration, social, branding)—not in Basis.

## Test

```bash
curl -sS "http://127.0.0.1:8090/api/v1/auth/org-sso-options"
curl -sS "http://127.0.0.1:8090/api/v1/auth/org-sso-hint?email=user@yourdomain.com"
```

Login page shows **企业 SSO** without typing email when org OIDC is enabled (`org-sso-options`). Click through → Logto → redirect to web with `?basis_token=`.

E2E (mock IdP, no Logto): `cd web && BASIS_E2E_WEB_PORT=5175 npm run test:e2e -- org-sso-login`

## Stop

```bash
docker compose -f compose.yml down
# Reset DB: docker compose -f compose.yml down -v
```

See also [ADR 0002](../../docs/architecture/0002-organization-tenant-sso.md).
