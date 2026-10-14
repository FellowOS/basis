"""Ontology operations on the current graph session."""

from __future__ import annotations

from typing import Any

from sema.graph.session import GraphSession


class OntologyService:
    def create(
        self,
        session: GraphSession,
        *,
        namespace: str,
        name: str,
        description: str | None = None,
    ) -> dict[str, Any]:
        ns = namespace.rstrip("/#")
        uri = f"{ns}#ontology"
        session.add_node(
            uri,
            "owl:Ontology",
            content=name,
            **{
                "rdfs:label": name,
                "rdfs:comment": description or "",
                "namespace": namespace,
            },
        )
        return {"uri": uri, "name": name, "namespace": namespace}

    def from_text(
        self,
        text: str,
        *,
        provider: str | None = None,
        model: str | None = None,
    ) -> dict[str, Any]:
        from semantica.ontology import OntologyEngine

        engine = OntologyEngine()
        return engine.from_text(text, provider=provider, model=model)
