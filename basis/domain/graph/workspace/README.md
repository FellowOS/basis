# `basis.domain.graph.workspace`

Server-side adapters for the vendored Explorer UI (`web/src/explorer/`). Graph mutations still flow through Review / ledger APIs — this package is not a second write path.

**Architecture docs:** [explorer-integration.md](../../../docs/architecture/explorer-integration.md), [explorer-backend.md](../../../docs/architecture/explorer-backend.md), [package-layout.md](../../../docs/architecture/package-layout.md) (import rules).

## Subpackages

| Path | Responsibility |
| --- | --- |
| `session/` | `GraphWorkspaceSessionRegistry`, auth guard, probe, `BasisKbGraphSession` |
| `graph/` | Projection reads, diff, staging payloads, import/export, semantic neighborhood |
| `governance/` | Decisions, enrich, provenance, governance trip side effects |
| `temporal/` | Temporal bounds and snapshots |
| `sparql/` | Read-only SPARQL over projection |
| `reasoning/` | Forward reasoning run + helpers (`forward.py`) |

Ontology Hub, SHACL, and RDF model I/O: **`basis/domain/ontology/`** (see [ontology README](../../ontology/README.md)). HTTP: `interface/http/kb_ontology_hub.py`.

## Imports

Use **subpackage modules**, for example:

```python
from basis.domain.graph.workspace.session.registry import GraphWorkspaceSessionRegistry
from basis.domain.graph.workspace.graph.read import get_node
from basis.domain.ontology.hub.catalog import list_ontologies
```

Do not reintroduce flat modules at the `workspace/` package root — CI runs `scripts/audit-graph-workspace-shim-imports.py` to block new compatibility shims in `basis/` and `tests/`.

Private symbols (`_parse_fact`, registry helpers, etc.) must be imported from the subpackage module that defines them.
