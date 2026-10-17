# @basis/client

Generated types and thin fetch wrapper for the **KB OpenAPI surface** (`openapi/basis-v1-kb.yaml`).

```bash
# From repo root (preferred)
node scripts/gen-client-types.mjs

# Or from packages/client
npm install
npm run gen:types   # openapi-typescript → src/schema.d.ts (full v1) + schema-kb.d.ts
npm run test
```

```ts
import { createBasisClient } from "@basis/client";

const client = createBasisClient({
  baseUrl: "https://basis.example",
  accessToken: process.env.BASIS_KB_TOKEN!,
});

await client.kb(kbId).searchChunks("Paris");
await client.kb(kbId).findEntities("Paris");
await client.kb(kbId).mcpInfo();

// Every OpenAPI path (typed):
const api = createBasisOpenApiClient({ baseUrl, accessToken: token });
await api.GET("/api/v1/auth/me");

// Console session (token from app state):
const session = createBasisSessionClient({
  baseUrl: "",
  getAccessToken: () => localStorage.getItem("basis_token"),
});
await session.fetchJson("/api/v1/kbs/k1/capabilities");
await session.sessionFetch("/api/v1/kbs/k1/alerts/stream", {
  headers: { Accept: "text/event-stream" },
});

// Login page (no bearer):
const publicApi = createBasisPublicOpenApiClient({ baseUrl: "" });
await publicApi.GET("/api/v1/auth/providers");
```

HTTP paths use `/api/v1/...` (see `docs/design/core-rest-sdk-refactor.md`).

**Web / env:** `BASIS_API_URL` (Vite proxy) and optional `VITE_BASIS_API_URL` (direct browser → API). The console wraps `createBasisSessionClient` in `web/src/lib/basis-session-client.ts`.
