"""Knowledge base and membership access."""

from __future__ import annotations

from typing import TYPE_CHECKING, Any

from basis.platform.admin.admin_types import (
    ROLE_RANK,
    KB_ROLES,
    KnowledgeBase,
    User,
    clean_name,
    kb_from_row,
    touches_owner,
    visibility as parse_visibility,
)
from basis.platform.admin.errors import AdminError
from basis.platform.admin.persistence import audit as audit_persist
from basis.platform.admin.persistence import knowledge_bases as kb_persist
from basis.platform.admin.persistence import users as users_persist

if TYPE_CHECKING:
    from basis.platform.admin.store import AdminStore


class KnowledgeBasesAccess:
    def __init__(self, store: AdminStore) -> None:
        self._store = store

    def list_visible_kbs(self, user: User) -> list[KnowledgeBase]:
        with self._store._lock:
            conn = self._store._conn
            if user.is_admin:
                rows = kb_persist.list_all_kbs(conn)
            else:
                rows = kb_persist.list_visible_kbs_for_user(conn, user.id)
        return [kb_from_row(row) for row in rows]

    def list_kb_ids(self) -> list[str]:
        with self._store._lock:
            return kb_persist.list_kb_ids(self._store._conn)

    def create_kb(
        self, actor: User, name: str, description: str | None, visibility: str
    ) -> KnowledgeBase:
        name = clean_name(name, "知识库名称")
        vis = parse_visibility(visibility)
        if vis == "open" and not actor.is_admin:
            raise AdminError(403, "forbidden", "只有系统管理员可以创建公开知识库")
        with self._store._lock:
            conn = self._store._conn
            org = self._store._organizations.create_organization_locked(
                name, owner_user_id=actor.id
            )
            kb_id = self._store._insert_kb(
                name, description or "", vis, actor.id, org.id
            )
            self._store._set_member(kb_id, actor.id, "owner", actor.id)
            kb = kb_from_row(kb_persist.fetch_kb(conn, kb_id))
            audit_persist.insert_audit(
                conn,
                actor_id=actor.id,
                action="kb.created",
                target_type="knowledge_base",
                target_id=kb_id,
                detail={"name": name},
            )
            conn.commit()
        return kb

    def get_kb_for(self, user: User, kb_id: str, minimum: str) -> tuple[KnowledgeBase, str]:
        with self._store._lock:
            row = kb_persist.fetch_kb(self._store._conn, kb_id)
            if row is None:
                raise AdminError(404, "not_found", "知识库不存在")
            kb = kb_from_row(row)
            role = self._store._access_role(user, kb)
        if role is None or ROLE_RANK[role] < ROLE_RANK[minimum]:
            raise AdminError(403, "forbidden", "没有权限")
        return kb, role

    def update_kb(
        self,
        actor: User,
        kb_id: str,
        *,
        name: str | None = None,
        description: str | None = None,
        visibility: str | None = None,
    ) -> KnowledgeBase:
        self.get_kb_for(actor, kb_id, "admin")
        vis: str | None = None
        if visibility is not None:
            vis = parse_visibility(visibility)
            if vis == "open" and not actor.is_admin:
                raise AdminError(403, "forbidden", "只有系统管理员可以把库改为公开")
        with self._store._lock:
            conn = self._store._conn
            current = kb_persist.fetch_kb(conn, kb_id)
            if current is None:
                raise AdminError(404, "not_found", "知识库不存在")
            kb_persist.update_kb(
                conn,
                kb_id,
                name=clean_name(name, "知识库名称") if name is not None else current["name"],
                description=description if description is not None else current["description"],
                visibility=vis if vis is not None else current["visibility"],
            )
            kb = kb_from_row(kb_persist.fetch_kb(conn, kb_id))
            audit_persist.insert_audit(
                conn,
                actor_id=actor.id,
                action="kb.updated",
                target_type="knowledge_base",
                target_id=kb_id,
                detail={},
            )
            conn.commit()
        return kb

    def delete_kb(self, actor: User, kb_id: str) -> None:
        _, role = self.get_kb_for(actor, kb_id, "admin")
        if role != "owner" and not actor.is_admin:
            raise AdminError(403, "forbidden", "只有所有者或系统管理员可以删除知识库")
        with self._store._lock:
            conn = self._store._conn
            kb_persist.delete_kb(conn, kb_id)
            audit_persist.insert_audit(
                conn,
                actor_id=actor.id,
                action="kb.deleted",
                target_type="knowledge_base",
                target_id=kb_id,
                detail={},
            )
            conn.commit()

    def list_members(self, actor: User, kb_id: str) -> list[dict[str, Any]]:
        self.get_kb_for(actor, kb_id, "viewer")
        with self._store._lock:
            rows = kb_persist.list_members(self._store._conn, kb_id)
        return [
            {
                "user_id": row["id"],
                "email": row["email"],
                "display_name": row["display_name"],
                "role": row["role"],
                "joined_at": row["joined_at"],
            }
            for row in rows
        ]

    def set_member_role(self, actor: User, kb_id: str, target_id: str, role: str) -> None:
        if role not in KB_ROLES:
            raise AdminError(422, "bad_role", "角色必须是 owner、admin、editor 或 viewer")
        _, caller_role = self.get_kb_for(actor, kb_id, "admin")
        with self._store._lock:
            conn = self._store._conn
            target = users_persist.fetch_user(conn, target_id)
            if target is None or target["deactivated_at"] is not None:
                raise AdminError(404, "not_found", "用户不存在")
            current = kb_persist.member_role(conn, kb_id, target_id)
            if touches_owner(current, role) and caller_role != "owner":
                raise AdminError(403, "forbidden", "只有所有者可以授予或取消所有者")
            if current == "owner" and role != "owner" and kb_persist.owner_count(conn, kb_id) <= 1:
                raise AdminError(409, "last_owner", "不能降级最后一个所有者")
            self._store._set_member(kb_id, target_id, role, actor.id)
            audit_persist.insert_audit(
                conn,
                actor_id=actor.id,
                action="member.role_set",
                target_type="knowledge_base",
                target_id=kb_id,
                detail={"user_id": target_id, "role": role},
            )
            conn.commit()

    def remove_member(self, actor: User, kb_id: str, target_id: str) -> None:
        _, caller_role = self.get_kb_for(actor, kb_id, "admin")
        with self._store._lock:
            conn = self._store._conn
            current = kb_persist.member_role(conn, kb_id, target_id)
            if current is None:
                raise AdminError(404, "not_found", "成员不存在")
            if current == "owner":
                if caller_role != "owner" and not actor.is_admin:
                    raise AdminError(403, "forbidden", "只有所有者可以移除所有者")
                if kb_persist.owner_count(conn, kb_id) <= 1:
                    raise AdminError(409, "last_owner", "不能移除最后一个所有者")
            kb_persist.remove_member(conn, kb_id, target_id)
            audit_persist.insert_audit(
                conn,
                actor_id=actor.id,
                action="member.removed",
                target_type="knowledge_base",
                target_id=kb_id,
                detail={"user_id": target_id},
            )
            conn.commit()
