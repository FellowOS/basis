# Logto — local OIDC for Basis (F-ACC-07 dev)

Use [docker/logto/compose.yml](../../docker/logto/compose.yml) to run **Logto OSS** beside Basis for org OIDC smoke tests. This is **not** a supported production IdP; see [enterprise-sso.md](enterprise-sso.md) for production checklists.

## Start Logto

```bash
cd docker/logto
docker compose up -d
```

Defaults:

| Service | URL |
| --- | --- |
| Logto API (issuer) | `http://localhost:3001` |
| Logto Admin | `http://localhost:3002` |

Override ports with `LOGTO_PORT_API`, `LOGTO_PORT_ADMIN`, and `LOGTO_ENDPOINT` / `LOGTO_ADMIN_ENDPOINT` in a `.env` next to `compose.yml` if needed.

## Create a Logto application

1. Open **Logto Admin** (`http://localhost:3002`) and complete first-time setup.
2. **Applications → Create application** → type **Traditional web** (authorization code).
3. **Redirect URIs** (exact): `{BASIS_PUBLIC_URL}/api/v1/auth/oidc/callback`  
   Example when API is on port 8090: `http://localhost:8090/api/v1/auth/oidc/callback`
4. Note **App ID** (client id) and **App secret**.

## Wire Basis org OIDC

1. Ensure Basis **Site URL** / `BASIS_PUBLIC_URL` matches what the browser uses (e.g. `http://localhost:8090`).
2. **Settings → Organization SSO → OpenID Connect** for your org:
   - **Issuer**: `http://localhost:3001/oidc` (Logto well-known base; Basis discovers metadata from `{issuer}/.well-known/openid-configuration`).
   - **Client ID** / **Client secret**: from Logto app.
   - **Scopes**: `openid email profile`
   - **Email domains**: a domain you can assign in Logto user profiles (or use Logto’s test user email).
3. Enable SSO and set sign-in policy as needed (`password_allowed` for first login).

## Smoke test

1. `GET /api/v1/auth/org-sso-hint?email={user@domain}` → `login_url`.
2. Complete login at Logto → redirect back to Basis web with `basis_token`.

## Troubleshooting

| Symptom | Check |
| --- | --- |
| `redirect_uri_mismatch` | Redirect URI in Logto must match Basis **Access** OAuth callback exactly. |
| Issuer discovery fails | API host must reach `http://localhost:3001` from the machine running `uv run basis`. |
| Email not provisioned | Logto user must have `email` (or `username` mapped) for JIT linking. |
