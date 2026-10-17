export const docs = {
  sidebarAria: 'Developer documentation',
  groups: {
    start: 'Get started',
    integrate: 'Integrate',
    reference: 'Reference',
    ops: 'Operations',
  },
  pages: {
    overview: {
      navTitle: 'Overview',
      title: 'Basis developer documentation',
      description:
        'Self-hosted knowledge platform: evidence ledger, graph and search projections, OpenAPI v1 HTTP, and MCP for agents.',
      sections: [
        {
          heading: 'What you can build on',
          paragraphs: [
            'Basis exposes versioned REST under `/api/v1/*`, per–knowledge-base routes under `/api/v1/kbs/{kb_id}/*`, and OpenAPI documents at `/openapi/v1.json`. Agents can use HTTP MCP on each knowledge base.',
          ],
          bullets: [
            'Platform API — users, knowledge bases, models, audit, settings',
            'Knowledge base API — ingest, ledger, search, graph, ontology, chat',
            'MCP — tool surface aligned with the same operations as OpenAPI',
          ],
        },
        {
          heading: 'Recommended path',
          paragraphs: ['Start locally, then read concepts before calling production APIs.'],
          bullets: [
            'Quickstart — run API + web console',
            'Concepts — ledger vs projections',
            'REST API — paths, auth, and surfaces',
            'API reference — interactive OpenAPI explorer',
          ],
        },
      ],
    },
    quickstart: {
      navTitle: 'Quickstart',
      title: 'Quickstart',
      description: 'Run the API and web console on your machine in a few commands.',
      sections: [
        {
          heading: 'Prerequisites',
          paragraphs: ['Python 3.10+ with uv, Node.js 22+ for the web app.'],
        },
        {
          heading: 'Run locally',
          paragraphs: [
            'From the repository root: copy `.env.example`, run `uv sync --extra dev && uv run basis` (API on port 8090). In `web/`: copy `.env.example`, `npm install && npm run dev` (console on port 5173).',
            'Register the first user — they become platform administrator.',
          ],
        },
        {
          heading: 'Verify',
          paragraphs: [
            'Open the console, create a knowledge base, and upload a source. Use the interactive API reference when you need exact request shapes.',
          ],
        },
      ],
      links: [{ label: 'Open API reference (Swagger UI)', href: '/swagger' }],
    },
    concepts: {
      navTitle: 'Core concepts',
      title: 'Core concepts',
      description: 'How Basis models knowledge so integrations stay consistent.',
      sections: [
        {
          heading: 'Evidence ledger is canonical',
          paragraphs: [
            'Facts and provenance live in the ledger. Graph views, search indexes, and exports are projections that can be rebuilt from evidence.',
          ],
        },
        {
          heading: 'Semantics',
          paragraphs: [
            'Ontologies, SHACL, SPARQL, mappings, and rules define meaning. Operations mutate ledger state; graph and search catch up via projection jobs.',
          ],
        },
        {
          heading: 'Surfaces to clients',
          paragraphs: [
            'Server operations are defined once in OpenAPI v1 and MCP. The web app uses the same contract via generated types — not a separate undocumented HTTP layer.',
          ],
        },
      ],
    },
    'rest-api': {
      navTitle: 'REST API',
      title: 'REST API (OpenAPI v1)',
      description: 'Versioned HTTP entrypoints and how to choose platform vs knowledge-base calls.',
      sections: [
        {
          heading: 'Base URL and versioning',
          paragraphs: [
            'All normative routes live under `/api/v1`. Unversioned `/api/*` is legacy and gated off by default (HTTP 410).',
          ],
        },
        {
          heading: 'OpenAPI documents',
          paragraphs: ['Three published specs share one implementation:'],
          bullets: [
            '`/openapi/v1.json` — full surface',
            '`/openapi/v1/platform.json` — platform administration',
            '`/openapi/v1/kb.json` — per–knowledge-base operations',
          ],
        },
        {
          heading: 'Session vs token',
          paragraphs: [
            'Browser console uses session cookies and Bearer tokens after login. Automation uses platform or per-KB access tokens — see Authentication.',
          ],
        },
      ],
      links: [
        { label: 'Interactive reference', href: '/swagger' },
        { label: 'Download OpenAPI JSON', href: '/openapi/v1.json', external: true },
      ],
    },
    auth: {
      navTitle: 'Authentication',
      title: 'Authentication & access',
      description: 'Users, sessions, API tokens, and KB-scoped credentials.',
      sections: [
        {
          heading: 'Console users',
          paragraphs: [
            'Register and sign in via `/api/v1/auth/*`. Sessions use cookies; the SPA stores a Bearer token for API calls when needed.',
          ],
        },
        {
          heading: 'Access tokens',
          paragraphs: [
            'Create tokens in the console for scripts and agents. Knowledge-base tokens scope MCP and KB OpenAPI paths to a single KB.',
          ],
        },
        {
          heading: 'Roles',
          paragraphs: [
            'Platform admins manage users and settings. KB members have roles (viewer, editor, …) enforced on each KB route.',
          ],
        },
      ],
    },
    mcp: {
      navTitle: 'MCP',
      title: 'MCP for agents',
      description: 'Expose a knowledge base to Cursor and other MCP clients over HTTP.',
      sections: [
        {
          heading: 'Alignment with OpenAPI',
          paragraphs: [
            'MCP tools map to the same operations as OpenAPI v1. Prefer MCP when the client already speaks the protocol; use REST for generic HTTP integrations.',
          ],
        },
        {
          heading: 'Setup outline',
          paragraphs: [
            'In KB settings, create an access token and note the MCP URL for that knowledge base. Configure your agent host with the token as Bearer credentials.',
          ],
        },
      ],
    },
    'api-reference': {
      navTitle: 'API reference',
      title: 'API reference',
      description:
        'Machine-readable OpenAPI v1 plus an interactive explorer — not a hand-maintained endpoint list.',
      sections: [
        {
          heading: 'Interactive explorer',
          paragraphs: [
            'Swagger UI loads the live spec from this deployment. Try it out sends requests from your browser; sign in first to attach your session token automatically.',
          ],
        },
        {
          heading: 'Spec variants',
          paragraphs: ['Switch between full, platform-only, and KB-only documents in the explorer toolbar.'],
        },
      ],
      links: [
        { label: 'Open Swagger UI', href: '/swagger' },
        { label: 'Full OpenAPI JSON', href: '/openapi/v1.json', external: true },
        { label: 'Platform OpenAPI JSON', href: '/openapi/v1/platform.json', external: true },
        { label: 'KB OpenAPI JSON', href: '/openapi/v1/kb.json', external: true },
      ],
    },
    deployment: {
      navTitle: 'Self-host',
      title: 'Self-host & configuration',
      description: 'Environment variables and production-oriented notes.',
      sections: [
        {
          heading: 'Core settings',
          paragraphs: ['Typical production toggles:'],
          bullets: [
            '`BASIS_HOST` / `BASIS_PORT` — API bind',
            '`BASIS_DATA_DIR` — SQLite, blobs, graph JSON (default)',
            '`BASIS_DATABASE_URL` — PostgreSQL for production',
            '`VITE_BASIS_API_URL` — browser API base when not same-origin',
          ],
        },
        {
          heading: 'Reverse proxy',
          paragraphs: [
            'Serve the web bundle and proxy `/api`, `/openapi`, and WebSocket paths to the API process. Docker and nginx examples live in the repository under `docker/production/`.',
          ],
        },
      ],
    },
  },
} as const;
