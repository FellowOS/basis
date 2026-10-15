# Graph workspace product closure (Sema)

Status snapshot for the KB **Explore → Graph** surface and its links to the rest of the
lifecycle. See [explorer-integration.md](./explorer-integration.md) for API contracts and gates.

## Closed (shipped in UI + API)

| Flow | Entry | Notes |
| --- | --- | --- |
| Open graph | `/kbs/:id/graph`, default KB landing | Capability `graph`; full-bleed canvas |
| Focus node | `?focus=<nodeId>` | From search, entities, sources after processing, chat citations |
| Search & reload | `GraphSearchDock`, paginated load | `POST .../graph/search` (current projection; KB Search **Graph** tab same — use timeline for `at`) |
| Point-in-time | Temporal scrubber | `GET .../temporal/snapshot?at=` (not chunk `as_of`) |
| Inspector | Path, link prediction, provenance download | Markdown edit gated by `graph_write` |
| Knowledge links | Inspector → sources (doc/chunk), search fallback | `graph-evidence-links` |
| Decisions | Inspector summary → `/review?tab=decisions&q=` | `DecisionWorkspace` URL params |
| Import / export | Dialog; import → `/review?tab=queue` | Gate D; no direct canvas merge |
| Processing → graph | Sources toast, row link, job history | `doc_id` as graph node id |
| Chat ↔ graph | `?focus=` on chat; tool citation chips | `chat-tool-links` |
| Projection rebuild | Graph toolbar + **Settings → Explorer 图谱** | `POST .../graph/rebuild`, audited |
| Projection status | `GET .../graph/projection` | Revision, status, counts |
| KB audit (members) | Settings panel + review timeline | `GET .../audit/graph-mutations` |
| Platform audit (admin) | `/audit` filters `kb_id`, `action_prefix` | Includes `kb.graph.projection_rebuild` |

## Ontology / SPARQL / mappings (Phase 3, partial)

| Surface | Route | Status |
| --- | --- | --- |
| Ontology Hub (registry, editor, SHACL, versions) | `/kbs/:id/ontology` → tab **Ontology hub** | KB adapters in `ontology_kb_hub.py`; Explorer `OntologyWorkspace` |
| SPARQL + reasoning | same page, tabs | `POST .../sparql`, reasoning via `kb_explorer` |
| SKOS + alignments | `/kbs/:id/vocabulary` | `kb_ontology` vocabulary routes |
| Phrase → type mappings | `/kbs/:id/mappings` | `kb_mappings` ledger |
| Connectors | `ingest_sources` + `/sources` API | **GA slice** — `webhook` / `http_poll` / GitHub raw `git` only (no new kinds); sync history in `config`; `?connectors=1` deep link |

## Intentionally out of scope (design)

- Canvas **direct merge** (`direct_graph_merge: false`) — use review / entity resolution.
- Standalone **Decision** top-level nav — lives under **Governance → Review** tab.
- **Registry** as durable history — platform/KB audit + review queue.
- Semantica **inner chrome** full token migration — graph HUD still mixed theme.

## Suggested manual test (15 min)

1. Ingest a doc on **Sources**, run processing, open **Graph** from toast.
2. Select document node → **Knowledge links** → Sources; **Continue in chat** → send → open citation.
3. Editor: **Import** JSON → **Review queue** → approve; graph updates (or WS / reload).
4. **Rebuild projection** on graph and in **Settings → Explorer 图谱**; viewer sees KB audit, not `/audit`.
5. Viewer role: no Markdown **Edit**, no rebuild; graph read works.

## Tests (automated)

- `tests/test_graph_snapshot.py` — projection GET, rebuild audit, viewer KB audit vs platform 403
- `tests/test_kb_review.py`, `tests/test_kb_explorer_routes.py` — graph-mutations audit
- `packages/web/src/lib/graph-evidence-links.test.ts` — evidence URL helper
- `packages/web/e2e/governance.spec.ts` — review → ontology versions, sources `?connectors=1`, search graph temporal hint → graph route
- `packages/web/e2e/onboarding.spec.ts`, `e2e/lineage.spec.ts`, `e2e/shell.spec.ts` — ingest + graph shell, provenance, nav
