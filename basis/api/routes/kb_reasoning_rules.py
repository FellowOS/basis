"""KB-scoped forward-chaining rule library (F-RUL-01)."""

from __future__ import annotations

from typing import Any

from fastapi import APIRouter, Depends, Query, Request
from pydantic import BaseModel, Field

from basis.admin.store import AdminStore, User
from basis.api.deps import get_current_user, get_kb_for_editor, get_kb_for_viewer, get_knowledge_store, get_store
from basis.knowledge.store import KnowledgeStore

router = APIRouter(prefix="/api/kbs", tags=["knowledge-bases"])


class CreateReasoningRuleRequest(BaseModel):
    name: str = Field(min_length=1, max_length=200)
    body: str = Field(min_length=1, max_length=16000)
    enabled: bool = True


class UpdateReasoningRuleRequest(BaseModel):
    name: str | None = Field(default=None, min_length=1, max_length=200)
    body: str | None = Field(default=None, min_length=1, max_length=16000)
    enabled: bool | None = None


@router.get("/{kb_id}/rules")
async def list_kb_reasoning_rules(
    kb_id: str,
    request: Request,
    limit: int = Query(100, ge=1, le=200),
    user: User = Depends(get_current_user),
    store: AdminStore = Depends(get_store),
    knowledge: KnowledgeStore = Depends(get_knowledge_store),
) -> dict[str, Any]:
    get_kb_for_viewer(request, user, kb_id, store)
    rules = knowledge.list_reasoning_rules(kb_id, limit=limit)
    return {"rules": rules}


@router.post("/{kb_id}/rules")
async def create_kb_reasoning_rule(
    kb_id: str,
    body: CreateReasoningRuleRequest,
    request: Request,
    user: User = Depends(get_current_user),
    store: AdminStore = Depends(get_store),
    knowledge: KnowledgeStore = Depends(get_knowledge_store),
) -> dict[str, Any]:
    get_kb_for_editor(request, user, kb_id, store)
    rule = knowledge.create_reasoning_rule(
        kb_id,
        name=body.name.strip(),
        body=body.body.strip(),
        actor_id=user.id,
        enabled=body.enabled,
    )
    return {"rule": rule}


@router.patch("/{kb_id}/rules/{rule_id}")
async def update_kb_reasoning_rule(
    kb_id: str,
    rule_id: str,
    body: UpdateReasoningRuleRequest,
    request: Request,
    user: User = Depends(get_current_user),
    store: AdminStore = Depends(get_store),
    knowledge: KnowledgeStore = Depends(get_knowledge_store),
) -> dict[str, Any]:
    get_kb_for_editor(request, user, kb_id, store)
    rule = knowledge.update_reasoning_rule(
        kb_id,
        rule_id,
        name=body.name.strip() if body.name is not None else None,
        body=body.body.strip() if body.body is not None else None,
        enabled=body.enabled,
    )
    return {"rule": rule}


@router.delete("/{kb_id}/rules/{rule_id}")
async def delete_kb_reasoning_rule(
    kb_id: str,
    rule_id: str,
    request: Request,
    user: User = Depends(get_current_user),
    store: AdminStore = Depends(get_store),
    knowledge: KnowledgeStore = Depends(get_knowledge_store),
) -> dict[str, Any]:
    get_kb_for_editor(request, user, kb_id, store)
    knowledge.delete_reasoning_rule(kb_id, rule_id)
    return {"ok": True}
