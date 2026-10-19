"""API token management."""

from __future__ import annotations

import json
import uuid
from datetime import datetime, timezone
from typing import TYPE_CHECKING

from basis.platform.admin.admin_types import (
    ApiTokenRecord,
    User,
    api_token_from_row,
    utc_now_iso,
)
from basis.platform.admin.errors import AdminError
from basis.platform.admin.passwords import hash_token
from basis.platform.admin.persistence import api_tokens as api_token_persist
from basis.platform.admin.persistence import audit as audit_persist

if TYPE_CHECKING:
    from basis.platform.admin.store import AdminStore


class ApiTokensAccess:
    def __init__(self, store: AdminStore) -> None:
        self._store = store

    def create_api_token(
        self,
        actor: User,
        *,
        name: str,
        scope: str,
        kb_ids: list[str],
        expires_at: str | None = None,
    ) -> tuple[ApiTokenRecord, str]:
        from basis.platform.admin.admin_types import secrets_token

        name = name.strip()
        if not name or len(name) > 64:
            raise AdminError(422, "bad_name", "令牌名称需要 1 到 64 个字符")
        if scope not in {"read", "write"}:
            raise AdminError(422, "bad_scope", "scope 必须是 read 或 write")
        if not kb_ids:
            raise AdminError(422, "bad_kb_ids", "至少选择一个知识库")
        cleaned: list[str] = []
        for kb_id in kb_ids:
            self._store._knowledge_bases.get_kb_for(actor, kb_id, "viewer")
            if kb_id not in cleaned:
                cleaned.append(kb_id)
        token_id = str(uuid.uuid4())
        plaintext = secrets_token()
        now = utc_now_iso()
        with self._store._lock:
            conn = self._store._conn
            api_token_persist.insert_api_token(
                conn,
                token_id=token_id,
                token_hash=hash_token(plaintext),
                token_secret=plaintext,
                user_id=actor.id,
                name=name,
                scope=scope,
                kb_ids_json=json.dumps(cleaned, ensure_ascii=False),
                created_at=now,
                expires_at=expires_at,
            )
            audit_persist.insert_audit(
                conn,
                actor_id=actor.id,
                action="api_token.created",
                target_type="api_token",
                target_id=token_id,
                detail={"name": name, "scope": scope, "kb_ids": cleaned},
            )
            conn.commit()
            row = api_token_persist.fetch_api_token(conn, token_id)
        return api_token_from_row(row), plaintext

    def list_api_tokens(self, actor: User) -> list[ApiTokenRecord]:
        with self._store._lock:
            rows = api_token_persist.list_api_tokens_for_user(self._store._conn, actor.id)
        return [api_token_from_row(row) for row in rows]

    def revoke_api_token(self, actor: User, token_id: str) -> None:
        with self._store._lock:
            conn = self._store._conn
            row = api_token_persist.fetch_api_token(conn, token_id)
            if row is None:
                raise AdminError(404, "not_found", "令牌不存在")
            if row["user_id"] != actor.id and not actor.is_admin:
                raise AdminError(403, "forbidden", "没有权限")
            if row["revoked_at"] is not None:
                return
            api_token_persist.revoke_api_token(conn, token_id, utc_now_iso())
            audit_persist.insert_audit(
                conn,
                actor_id=actor.id,
                action="api_token.revoked",
                target_type="api_token",
                target_id=token_id,
                detail={},
            )
            conn.commit()

    def delete_api_token(self, actor: User, token_id: str) -> None:
        with self._store._lock:
            conn = self._store._conn
            row = api_token_persist.fetch_api_token(conn, token_id)
            if row is None:
                raise AdminError(404, "not_found", "令牌不存在")
            if row["user_id"] != actor.id and not actor.is_admin:
                raise AdminError(403, "forbidden", "没有权限")
            api_token_persist.delete_api_token(conn, token_id)
            audit_persist.insert_audit(
                conn,
                actor_id=actor.id,
                action="api_token.deleted",
                target_type="api_token",
                target_id=token_id,
                detail={},
            )
            conn.commit()

    def resolve_api_token(self, token: str) -> tuple[User, ApiTokenRecord] | None:
        from basis.platform.admin.admin_types import User as UserType

        digest = hash_token(token)
        with self._store._lock:
            conn = self._store._conn
            row = api_token_persist.resolve_api_token_row(conn, digest)
            if row is None:
                return None
            if row["revoked_at"] is not None:
                return None
            expires_at = row["expires_at"]
            if expires_at:
                try:
                    exp = datetime.fromisoformat(expires_at.replace("Z", "+00:00"))
                    if exp <= datetime.now(timezone.utc):
                        return None
                except ValueError:
                    pass
            api_token_persist.touch_api_token_last_used(conn, row["id"])
            conn.commit()
        user = UserType(
            id=row["uid"],
            email=row["email"],
            display_name=row["display_name"],
            is_admin=bool(row["is_admin"]),
            deactivated_at=row["deactivated_at"],
            created_at=row["user_created_at"],
        )
        record = api_token_from_row(row)
        return user, record

    def api_token_allows_kb(self, record: ApiTokenRecord, kb_id: str) -> bool:
        return kb_id in record.kb_ids
