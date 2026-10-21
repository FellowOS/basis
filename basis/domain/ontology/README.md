# `basis.domain.ontology`

Business-semantics **model layer** for a KB: Ontology Hub (registry, drafts, proposals), SHACL, browse/preview, RDF I/O, and shared RDF parse helpers (`io/`).

Graph **projection** and interactive reads live in `basis.domain.graph` (`projection/`, `session/`, `reads/`, …). Canonical facts remain in `basis.domain.knowledge`.

## Subpackages

| Path | Responsibility |
| --- | --- |
| `hub/` | Registry, persistence, proposals, governance lifecycle |
| `shacl/` | Generate, validate, read SHACL |
| `browse/` | Graph scope, health, SKOS-oriented reads, preview |
| `io/` | RDF parse + admin error mapping for ontology HTTP |
| `vocabulary/` | SKOS schemes, concepts, import |
| `mappings/` | Statement surface → ontology URI mappings (SQL + `MappingsAccess`) |
| `reasoning_rules/` | Forward-reasoning rule rows (SQL + `ReasoningRulesAccess`) |
| `legacy_graph_create.py` | Legacy `POST …/ontology` graph-node fallback |

## Imports

```python
from basis.domain.ontology.hub.catalog import list_registry
from basis.domain.ontology.hub.kb_scoped_state import KbOntologyState
from basis.domain.ontology.io.rdf_parse import safe_parse_rdf
```
