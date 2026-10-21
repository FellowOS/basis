"""KB Explorer reasoning run route."""

from __future__ import annotations

import asyncio
from typing import Any

from fastapi import APIRouter, Depends, Request

from basis.domain.errors import AdminError
from basis.domain.tenancy.admin.store import AdminStore, User
from basis.interface.http.deps import (
    graph_workspace_runtime_for,
    get_current_user,
    get_knowledge_store,
    get_store,
    rebuild_kb_projection,
    save_graph,
)
from basis.domain.graph.session.guard import require_graph_workspace_session
from basis.domain.knowledge.services.graph_audit import audit_kb_graph
from basis.domain.knowledge.store import KnowledgeStore

router = APIRouter(tags=["knowledge-bases"])

@router.post("/{kb_id}/reasoning/run")
async def kb_reasoning_run(
    kb_id: str,
    request: Request,
    user: User = Depends(get_current_user),
    store: AdminStore = Depends(get_store),
    knowledge: KnowledgeStore = Depends(get_knowledge_store),
) -> Any:
    """
Kb Reasoning Run. KB-local reasoning rules and runs. Requires KB membership (session) or KB API token with read/write scope. All paths are scoped to `{kb_id}`.
    """
    from basis.domain.graph.reasoning.forward import proof_chains_for_run
    from basis.domain.graph.reasoning.run import run_reasoning

    raw = await request.json()
    if not isinstance(raw, dict):
        raise AdminError(422, "validation_error", "请求体须为 JSON 对象")
    facts = raw.get("facts")
    rules = raw.get("rules")
    if not isinstance(facts, list) or not isinstance(rules, list):
        raise AdminError(422, "validation_error", "facts 与 rules 须为字符串数组")
    apply_to_graph = bool(raw.get("apply_to_graph", False))
    role = "editor" if apply_to_graph else "viewer"
    store.get_kb_for(user, kb_id, role)
    runtime = graph_workspace_runtime_for(request, kb_id)
    session = require_graph_workspace_session(runtime)
    summary = await asyncio.to_thread(
        run_reasoning,
        session,
        facts=[str(f) for f in facts],
        rules=[str(r) for r in rules],
        mode=str(raw.get("mode", "forward")),
        apply_to_graph=apply_to_graph,
        inferred_edge_type=raw.get("inferred_edge_type"),
    )
    summary["proof_chains"] = proof_chains_for_run(
        [str(f) for f in facts],
        [str(r) for r in rules],
        list(summary.get("inferred_facts") or []),
    )
    if apply_to_graph and summary.get("mutated"):
        from basis.domain.knowledge.services.derived_facts_service import persist_reasoning_derived

        summary["derived_facts_persisted"] = persist_reasoning_derived(
            knowledge,
            kb_id,
            list(summary.get("proof_chains") or []),
        )
        created = int(summary["derived_facts_persisted"].get("created") or 0)
        if created > 0:
            summary["projection"] = rebuild_kb_projection(request, kb_id)
        else:
            save_graph(request, kb_id)
        audit_kb_graph(
            store,
            user,
            kb_id,
            "kb.graph.reasoning_apply",
            extra={
                "added_edges": summary.get("added_edges"),
                "rules_fired": summary.get("rules_fired"),
                "derived_facts_created": created,
                **(
                    {"projection_revision": summary["projection"].get("projection_revision")}
                    if isinstance(summary.get("projection"), dict)
                    else {}
                ),
            },
        )
    return summary

