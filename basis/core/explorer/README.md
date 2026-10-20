# `basis.core.explorer`

Server-side adapters for the vendored Explorer UI (`web/src/explorer/`). Graph mutations still flow through Review / ledger APIs — this package is not a second write path.

**Architecture docs:** [explorer.md](../../../docs/architecture/explorer.md), [explorer-session-registry.md](../../../docs/architecture/explorer-session-registry.md), [package-layout.md](../../../docs/architecture/package-layout.md) (import rules).

## Subpackages

| Path | Responsibility |
| --- | --- |
| `session/` | `ExplorerSessionRegistry`, auth guard, probe, `BasisKbGraphSession` |
| `graph/` | Projection reads, diff, staging payloads, import/export, semantic neighborhood |
| `ontology/` | Ontology Hub (catalog, RDF, SHACL, proposals, per-KB hub JSON) |
| `governance/` | Decisions, enrich, provenance, governance trip side effects |
| `vocabulary/` | SKOS browse + import |
| `temporal/` | Temporal bounds and snapshots |
| `sparql/` | Read-only SPARQL over projection |
| `reasoning/` | Forward reasoning run + helpers (`forward.py`) |
| `io/` | RDF parse helpers; Explorer HTTP error mapping |

HTTP for the Ontology Hub lives in `basis/transport/http/kb_ontology_hub.py` (not under this tree).

## Imports

Use **subpackage modules**, for example:

```python
from basis.core.explorer.session.registry import ExplorerSessionRegistry
from basis.core.explorer.graph.read import get_node
from basis.core.explorer.ontology.catalog import list_ontologies
```

Do not reintroduce flat modules at the `explorer/` package root — CI runs `scripts/audit-explorer-shim-imports.py` to block new compatibility shims in `basis/` and `tests/`.

Private symbols (`_parse_fact`, registry helpers, etc.) must be imported from the subpackage module that defines them.
