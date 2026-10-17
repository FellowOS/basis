# Authentik (local OIDC IdP for Basis dev)

Runs [Authentik](https://goauthentik.io/) via Docker Compose for testing organization SSO / OIDC against Basis (before Basis implements the full OAuth routes).

## Start

```bash
cd docker/authentik
cp .env.example .env
# If .env is empty, generate secrets:
echo "PG_PASS=$(openssl rand -base64 36 | tr -d '\n')" >> .env
echo "AUTHENTIK_SECRET_KEY=$(openssl rand -base64 60 | tr -d '\n')" >> .env
docker compose -f compose.yml pull
docker compose -f compose.yml up -d
```

Admin UI: **http://localhost:9000** — first visit sets password for user `akadmin`.

## OIDC app for Basis (manual, until Basis OAuth ships)

1. **Applications → Create** — name e.g. `Basis Dev`.
2. **Provider**: OAuth2/OpenID Connect; client type **Confidential** (or Public for SPA-only experiments).
3. **Redirect URI** (future Basis callback): `http://localhost:8090/api/auth/oidc/callback`
4. Copy **Client ID** and **Client secret**.
5. **Issuer** for Authlib / org SSO config:
   - OpenID configuration: `http://localhost:9000/application/o/<slug>/.well-known/openid-configuration`
   - Or use the provider’s documented issuer from the Authentik admin UI.

Create a test user under **Directory → Users** and assign the application.

## Stop

```bash
docker compose -f compose.yml down
# Remove data: docker compose -f compose.yml down -v && rm -rf data certs custom-templates
```

## Notes

- Default HTTP port **9000** (change with `COMPOSE_PORT_HTTP` in `.env`).
- `.env`, `data/`, and `certs/` are gitignored; do not commit secrets.
