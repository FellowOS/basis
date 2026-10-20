# Ontology Hub registry persistence (ADR fragment)

**Status:** Accepted (Phase 2, 2026-10)  
**Related:** [semantica-base-sdk-plan.md](semantica-base-sdk-plan.md) P2-1, [explorer-session-registry.md](explorer-session-registry.md)

## Context

Ontology Hub keeps per-KB **registry metadata** (loaded ontologies), **alignments**, and **governance** stores (drafts, proposals, versions) in `app.state.kb_ontology_*[kb_id]`, with sidecar persistence under `graphs/{kb}.ontology-hub.json`.

## Decision

1. **Runtime source of truth:** `FastAPI` `app.state` maps keyed by `kb_id` (`kb_ontology_registries`, `kb_ontology_alignments`, `kb_ontology_drafts`, `kb_ontology_proposals`, `kb_ontology_versions`).
2. **Persistence (current):** JSON sidecar next to the graph snapshot: `{data_dir}/graphs/{kb_id}.ontology-hub.json` (`ontology_hub_persistence.py`), schema version `1`. Written on graph save / hub mutations via `persist_kb_ontology_hub`; deleted with graph `drop_graph`.
3. **Governance models:** Pydantic types in `ontology_hub_models.py` (OpenAPI-compatible with vendored Explorer UI).
4. **Postgres (future):** Optional follow-up when multi-instance API or query/reporting on registry is required. Migration would lift the same JSON shape into a `kb_ontology_hub` table or normalized registry table; sidecar remains valid for single-node self-host until then.

## Consequences

- Restart preserves hub state when graph persistence is enabled and sidecar exists.
- **No** monkey-patch of `semantica` `_get_registry` / `_get_drafts` (P2-3): KB scoping is entirely Basis-owned.
- RDF ingest and graph nodes remain on `GraphSession` / `ContextGraph`; registry rows are metadata only, not a second graph store.

## Non-goals

- Storing full OWL documents in Postgres (evidence / graph projection stays canonical).
- Changing `load_ontology` / OntologyIngestor semantics (Line 2 RDF import scope removed).
