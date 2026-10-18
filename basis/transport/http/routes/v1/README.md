# `/api/v1` routing (R2 / R6)

Normative HTTP paths live in `openapi/basis-v1*.yaml`. Route modules under `basis/api/routes/` register handlers with **`/api/v1/...` prefixes** (no path rewrite).

- **`LegacyApiGateMiddleware`** — when `BASIS_LEGACY_API_ENABLED=0` (default), unversioned `/api/*` returns **410** (WebSocket close 1008).
- **`LegacyApiDeprecationMiddleware`** — if legacy routes are re-enabled for migration, unversioned responses get `Deprecation` + `Link`.
- **`/health`** remains unversioned for probes; **`/api/v1/health`** is the OpenAPI-documented alias.
