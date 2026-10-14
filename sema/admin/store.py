"""Accounts, knowledge bases, membership, settings, and the audit log."""

from __future__ import annotations

import json
import sqlite3
import threading
import uuid
from dataclasses import dataclass
from datetime import datetime, timezone
from pathlib import Path
from typing import Any

from sema.admin.errors import AdminError
from sema.admin.passwords import hash_password, hash_token, verify_password
from sema.database import Database, get_sqlite_database
from sema.models.catalog import (
    CATALOG_SETTINGS_KEY,
    ModelKind,
    find_entry,
    model_secret_key,
    new_entry,
    parse_catalog,
    serialize_catalog,
)

ROLE_RANK = {"viewer": 1, "editor": 2, "admin": 3, "owner": 4}
KB_ROLES = frozenset(ROLE_RANK)


def _now() -> str:
    return datetime.now(timezone.utc).isoformat()


@dataclass(frozen=True)
class User:
    id: str
    email: str
    display_name: str
    is_admin: bool
    deactivated_at: str | None
    created_at: str

    def public(self) -> dict[str, Any]:
        return {
            "id": self.id,
            "email": self.email,
            "display_name": self.display_name,
            "is_admin": self.is_admin,
            "deactivated_at": self.deactivated_at,
            "created_at": self.created_at,
        }


@dataclass(frozen=True)
class ApiTokenRecord:
    id: str
    user_id: str
    name: str
    scope: str
    kb_ids: tuple[str, ...]
    created_at: str
    expires_at: str | None
    last_used_at: str | None
    revoked_at: str | None
    token_secret: str | None

    def public(self) -> dict[str, Any]:
        payload: dict[str, Any] = {
            "id": self.id,
            "name": self.name,
            "scope": self.scope,
            "kb_ids": list(self.kb_ids),
            "created_at": self.created_at,
            "expires_at": self.expires_at,
            "last_used_at": self.last_used_at,
            "revoked_at": self.revoked_at,
        }
        if self.revoked_at is None and self.token_secret:
            payload["secret"] = self.token_secret
        return payload


@dataclass(frozen=True)
class KnowledgeBase:
    id: str
    name: str
    description: str
    visibility: str
    created_by: str
    created_at: str

    def public(self) -> dict[str, Any]:
        return {
            "id": self.id,
            "name": self.name,
            "description": self.description,
            "visibility": self.visibility,
            "created_by": self.created_by,
            "created_at": self.created_at,
        }


class AdminStore:
    def __init__(self, path: Path | Database) -> None:
        if isinstance(path, Database):
            self._db = path
            self._owns_db_ref = False
        else:
            self._db = get_sqlite_database(path)
            self._owns_db_ref = True
        self._lock = self._db.lock
        self._conn = self._db.conn

    def close(self) -> None:
        if self._owns_db_ref:
            self._db.release()

    def register(self, email: str, password: str, display_name: str) -> tuple[User, str]:
        email = _clean_email(email)
        display_name = _clean_name(display_name, "显示名")
        _check_password(password)
        with self._lock:
            first = self._conn.execute("SELECT COUNT(*) AS n FROM users").fetchone()["n"] == 0
            if not first and self._setting("open_registration") != "true":
                raise AdminError(403, "registration_closed", "注册已关闭")
            if self._active_by_email(email) is not None:
                raise AdminError(409, "email_taken", "这个邮箱已经注册")
            user = self._insert_user(email, password, display_name, is_admin=first)
            token = self._issue_token(user.id)
            kb_id = None
            if first:
                kb_id = self._insert_kb(
                    "公共知识库", "", "open", user.id
                )
                self._set_member(kb_id, user.id, "owner", user.id)
            self._audit(user.id, "auth.register", "user", user.id, {"email": email})
            self._conn.commit()
        return user, token

    def login(self, email: str, password: str) -> tuple[User, str]:
        email = email.strip().lower()
        with self._lock:
            row = self._active_by_email(email)
            if row is None or not verify_password(password, row["password_hash"]):
                reason = "unknown_email" if row is None else "bad_password"
                self._audit(None, "auth.login_failed", "user", None, {"email": email, "reason": reason})
                self._conn.commit()
                raise AdminError(401, "invalid_credentials", "邮箱或密码不正确")
            user = _user_from_row(row)
            token = self._issue_token(user.id)
            self._audit(user.id, "auth.login", "user", user.id, {})
            self._conn.commit()
        return user, token

    def logout(self, token: str, user_id: str) -> None:
        with self._lock:
            self._conn.execute(
                "DELETE FROM tokens WHERE token_hash = ?", (hash_token(token),)
            )
            self._audit(user_id, "auth.logout", "user", user_id, {})
            self._conn.commit()

    def get_user_by_id(self, user_id: str) -> User | None:
        with self._lock:
            row = self._user(user_id)
        if row is None:
            return None
        return _user_from_row(row)

    def user_by_token(self, token: str) -> User | None:
        with self._lock:
            row = self._conn.execute(
                """
                SELECT u.* FROM tokens t
                JOIN users u ON u.id = t.user_id
                WHERE t.token_hash = ? AND u.deactivated_at IS NULL
                """,
                (hash_token(token),),
            ).fetchone()
        return _user_from_row(row) if row else None

    def create_api_token(
        self,
        actor: User,
        *,
        name: str,
        scope: str,
        kb_ids: list[str],
        expires_at: str | None = None,
    ) -> tuple[ApiTokenRecord, str]:
        name = name.strip()
        if not name or len(name) > 64:
            raise AdminError(422, "bad_name", "令牌名称需要 1 到 64 个字符")
        if scope not in {"read", "write"}:
            raise AdminError(422, "bad_scope", "scope 必须是 read 或 write")
        if not kb_ids:
            raise AdminError(422, "bad_kb_ids", "至少选择一个知识库")
        cleaned: list[str] = []
        for kb_id in kb_ids:
            self.get_kb_for(actor, kb_id, "viewer")
            if kb_id not in cleaned:
                cleaned.append(kb_id)
        token_id = str(uuid.uuid4())
        plaintext = secrets_token()
        now = _now()
        with self._lock:
            self._conn.execute(
                """
                INSERT INTO api_tokens(
                    id, token_hash, token_secret, user_id, name, scope, kb_ids_json,
                    created_at, expires_at, last_used_at, revoked_at
                ) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, NULL, NULL)
                """,
                (
                    token_id,
                    hash_token(plaintext),
                    plaintext,
                    actor.id,
                    name,
                    scope,
                    json.dumps(cleaned, ensure_ascii=False),
                    now,
                    expires_at,
                ),
            )
            self._audit(
                actor.id,
                "api_token.created",
                "api_token",
                token_id,
                {"name": name, "scope": scope, "kb_ids": cleaned},
            )
            self._conn.commit()
            row = self._api_token_row(token_id)
        return _api_token_from_row(row), plaintext

    def list_api_tokens(self, actor: User) -> list[ApiTokenRecord]:
        with self._lock:
            rows = self._conn.execute(
                """
                SELECT * FROM api_tokens
                WHERE user_id = ?
                ORDER BY created_at DESC
                """,
                (actor.id,),
            ).fetchall()
        return [_api_token_from_row(row) for row in rows]

    def revoke_api_token(self, actor: User, token_id: str) -> None:
        with self._lock:
            row = self._api_token_row(token_id)
            if row is None:
                raise AdminError(404, "not_found", "令牌不存在")
            if row["user_id"] != actor.id and not actor.is_admin:
                raise AdminError(403, "forbidden", "没有权限")
            if row["revoked_at"] is not None:
                return
            self._conn.execute(
                "UPDATE api_tokens SET revoked_at = ?, token_secret = NULL WHERE id = ?",
                (_now(), token_id),
            )
            self._audit(actor.id, "api_token.revoked", "api_token", token_id, {})
            self._conn.commit()

    def delete_api_token(self, actor: User, token_id: str) -> None:
        with self._lock:
            row = self._api_token_row(token_id)
            if row is None:
                raise AdminError(404, "not_found", "令牌不存在")
            if row["user_id"] != actor.id and not actor.is_admin:
                raise AdminError(403, "forbidden", "没有权限")
            self._conn.execute("DELETE FROM api_tokens WHERE id = ?", (token_id,))
            self._audit(actor.id, "api_token.deleted", "api_token", token_id, {})
            self._conn.commit()

    def resolve_api_token(self, token: str) -> tuple[User, ApiTokenRecord] | None:
        digest = hash_token(token)
        with self._lock:
            row = self._conn.execute(
                """
                SELECT t.*, u.id AS uid, u.email, u.display_name, u.is_admin,
                       u.deactivated_at, u.created_at AS user_created_at
                FROM api_tokens t
                JOIN users u ON u.id = t.user_id
                WHERE t.token_hash = ? AND u.deactivated_at IS NULL
                """,
                (digest,),
            ).fetchone()
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
            self._conn.execute(
                "UPDATE api_tokens SET last_used_at = ? WHERE id = ?",
                (_now(), row["id"]),
            )
            self._conn.commit()
        user = User(
            id=row["uid"],
            email=row["email"],
            display_name=row["display_name"],
            is_admin=bool(row["is_admin"]),
            deactivated_at=row["deactivated_at"],
            created_at=row["user_created_at"],
        )
        record = _api_token_from_row(row)
        return user, record

    def api_token_allows_kb(self, record: ApiTokenRecord, kb_id: str) -> bool:
        return kb_id in record.kb_ids

    def list_users(self, *, deactivated: bool = False) -> list[User]:
        clause = "deactivated_at IS NOT NULL" if deactivated else "deactivated_at IS NULL"
        with self._lock:
            rows = self._conn.execute(
                f"SELECT * FROM users WHERE {clause} ORDER BY created_at"
            ).fetchall()
        return [_user_from_row(row) for row in rows]

    def create_user(
        self,
        actor: User,
        email: str,
        password: str,
        display_name: str,
        *,
        is_admin: bool = False,
    ) -> User:
        _require_system_admin(actor)
        email = _clean_email(email)
        display_name = _clean_name(display_name, "显示名")
        _check_password(password)
        with self._lock:
            if self._active_by_email(email) is not None:
                raise AdminError(409, "email_taken", "这个邮箱已经注册")
            user = self._insert_user(email, password, display_name, is_admin=is_admin)
            self._audit(actor.id, "user.created", "user", user.id, {"email": email, "is_admin": is_admin})
            self._conn.commit()
        return user

    def deactivate_user(self, actor: User, target_id: str) -> None:
        _require_system_admin(actor)
        with self._lock:
            target = self._user(target_id)
            if target is None or target["deactivated_at"] is not None:
                raise AdminError(404, "not_found", "用户不存在")
            if target["is_admin"] and self._active_admin_count() <= 1:
                raise AdminError(409, "last_admin", "不能停用最后一个管理员")
            if target["id"] == actor.id:
                raise AdminError(409, "cannot_deactivate_self", "不能停用自己")
            self._conn.execute(
                "UPDATE users SET deactivated_at = ? WHERE id = ?", (_now(), target_id)
            )
            self._conn.execute("DELETE FROM tokens WHERE user_id = ?", (target_id,))
            self._audit(actor.id, "user.deactivated", "user", target_id, {})
            self._conn.commit()

    def reactivate_user(self, actor: User, target_id: str) -> None:
        _require_system_admin(actor)
        with self._lock:
            target = self._user(target_id)
            if target is None or target["deactivated_at"] is None:
                raise AdminError(404, "not_found", "没有已停用的用户")
            taken = self._active_by_email(target["email"])
            if taken is not None:
                raise AdminError(409, "email_taken", "这个邮箱已被另一个在用账号占用")
            self._conn.execute(
                "UPDATE users SET deactivated_at = NULL WHERE id = ?", (target_id,)
            )
            self._audit(actor.id, "user.reactivated", "user", target_id, {})
            self._conn.commit()

    def list_visible_kbs(self, user: User) -> list[KnowledgeBase]:
        with self._lock:
            if user.is_admin:
                rows = self._conn.execute(
                    "SELECT * FROM knowledge_bases ORDER BY created_at"
                ).fetchall()
            else:
                rows = self._conn.execute(
                    """
                    SELECT kb.* FROM knowledge_bases kb
                    LEFT JOIN kb_members m ON m.kb_id = kb.id AND m.user_id = ?
                    WHERE kb.visibility = 'open' OR m.user_id IS NOT NULL
                    ORDER BY kb.created_at
                    """,
                    (user.id,),
                ).fetchall()
        return [_kb_from_row(row) for row in rows]

    def list_kb_ids(self) -> list[str]:
        with self._lock:
            rows = self._conn.execute(
                "SELECT id FROM knowledge_bases ORDER BY created_at"
            ).fetchall()
        return [row["id"] for row in rows]

    def create_kb(
        self, actor: User, name: str, description: str | None, visibility: str
    ) -> KnowledgeBase:
        name = _clean_name(name, "知识库名称")
        visibility = _visibility(visibility)
        if visibility == "open" and not actor.is_admin:
            raise AdminError(403, "forbidden", "只有系统管理员可以创建公开知识库")
        with self._lock:
            kb_id = self._insert_kb(name, description or "", visibility, actor.id)
            self._set_member(kb_id, actor.id, "owner", actor.id)
            kb = _kb_from_row(self._kb_row(kb_id))
            self._audit(actor.id, "kb.created", "knowledge_base", kb_id, {"name": name})
            self._conn.commit()
        return kb

    def get_kb_for(self, user: User, kb_id: str, minimum: str) -> tuple[KnowledgeBase, str]:
        with self._lock:
            row = self._kb_row(kb_id)
            if row is None:
                raise AdminError(404, "not_found", "知识库不存在")
            kb = _kb_from_row(row)
            role = self._access_role(user, kb)
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
        if visibility is not None:
            visibility = _visibility(visibility)
            if visibility == "open" and not actor.is_admin:
                raise AdminError(403, "forbidden", "只有系统管理员可以把库改为公开")
        with self._lock:
            current = self._kb_row(kb_id)
            if current is None:
                raise AdminError(404, "not_found", "知识库不存在")
            self._conn.execute(
                """
                UPDATE knowledge_bases
                SET name = ?, description = ?, visibility = ?
                WHERE id = ?
                """,
                (
                    _clean_name(name, "知识库名称") if name is not None else current["name"],
                    description if description is not None else current["description"],
                    visibility if visibility is not None else current["visibility"],
                    kb_id,
                ),
            )
            kb = _kb_from_row(self._kb_row(kb_id))
            self._audit(actor.id, "kb.updated", "knowledge_base", kb_id, {})
            self._conn.commit()
        return kb

    def delete_kb(self, actor: User, kb_id: str) -> None:
        _, role = self.get_kb_for(actor, kb_id, "admin")
        if role != "owner" and not actor.is_admin:
            raise AdminError(403, "forbidden", "只有所有者或系统管理员可以删除知识库")
        with self._lock:
            self._conn.execute("DELETE FROM kb_members WHERE kb_id = ?", (kb_id,))
            self._conn.execute("DELETE FROM knowledge_bases WHERE id = ?", (kb_id,))
            self._audit(actor.id, "kb.deleted", "knowledge_base", kb_id, {})
            self._conn.commit()

    def list_members(self, actor: User, kb_id: str) -> list[dict[str, Any]]:
        self.get_kb_for(actor, kb_id, "viewer")
        with self._lock:
            rows = self._conn.execute(
                """
                SELECT m.role, m.joined_at, u.id, u.email, u.display_name
                FROM kb_members m
                JOIN users u ON u.id = m.user_id
                WHERE m.kb_id = ? AND u.deactivated_at IS NULL
                ORDER BY m.joined_at
                """,
                (kb_id,),
            ).fetchall()
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
        with self._lock:
            target = self._user(target_id)
            if target is None or target["deactivated_at"] is not None:
                raise AdminError(404, "not_found", "用户不存在")
            current = self._member_role(kb_id, target_id)
            if _touches_owner(current, role) and caller_role != "owner":
                raise AdminError(403, "forbidden", "只有所有者可以授予或取消所有者")
            if current == "owner" and role != "owner" and self._owner_count(kb_id) <= 1:
                raise AdminError(409, "last_owner", "不能降级最后一个所有者")
            self._set_member(kb_id, target_id, role, actor.id)
            self._audit(
                actor.id, "member.role_set", "knowledge_base", kb_id, {"user_id": target_id, "role": role}
            )
            self._conn.commit()

    def remove_member(self, actor: User, kb_id: str, target_id: str) -> None:
        _, caller_role = self.get_kb_for(actor, kb_id, "admin")
        with self._lock:
            current = self._member_role(kb_id, target_id)
            if current is None:
                raise AdminError(404, "not_found", "成员不存在")
            if current == "owner":
                if caller_role != "owner" and not actor.is_admin:
                    raise AdminError(403, "forbidden", "只有所有者可以移除所有者")
                if self._owner_count(kb_id) <= 1:
                    raise AdminError(409, "last_owner", "不能移除最后一个所有者")
            self._conn.execute(
                "DELETE FROM kb_members WHERE kb_id = ? AND user_id = ?",
                (kb_id, target_id),
            )
            self._audit(
                actor.id, "member.removed", "knowledge_base", kb_id, {"user_id": target_id}
            )
            self._conn.commit()

    def _read_model_catalog(self) -> dict[str, list[dict[str, Any]]]:
        catalog = parse_catalog(self._setting(CATALOG_SETTINGS_KEY))
        self._migrate_legacy_models_into_catalog(catalog)
        return catalog

    def _write_model_catalog(self, catalog: dict[str, list[dict[str, Any]]]) -> None:
        self._put_setting(CATALOG_SETTINGS_KEY, serialize_catalog(catalog))

    def _migrate_legacy_models_into_catalog(self, catalog: dict[str, list[dict[str, Any]]]) -> None:
        if self._setting("model_catalog_legacy_imported") == "true":
            return
        if not catalog["llm"] and (self._setting("chat_model") or "").strip():
            entry = new_entry(
                "llm",
                provider=self._setting("chat_provider") or "custom",
                api_base=self._setting("chat_base_url") or "",
                model=self._setting("chat_model") or "",
                enabled=True,
            )
            catalog["llm"].append(entry)
            legacy_key = self._setting("chat_api_key")
            if legacy_key:
                self._put_setting(model_secret_key(entry["id"]), legacy_key)
            self._write_model_catalog(catalog)
        migrated = bool(catalog["llm"] or catalog["embed"])
        if not catalog["embed"] and (self._setting("embed_model") or "").strip():
            entry = new_entry(
                "embed",
                provider=self._setting("embed_provider") or "custom",
                api_base=self._setting("embed_base_url") or "",
                model=self._setting("embed_model") or "",
                enabled=True,
            )
            catalog["embed"].append(entry)
            legacy_key = self._setting("embed_api_key")
            if legacy_key:
                self._put_setting(model_secret_key(entry["id"]), legacy_key)
            self._write_model_catalog(catalog)
            migrated = True
        if migrated or self._setting(CATALOG_SETTINGS_KEY):
            self._put_setting("model_catalog_legacy_imported", "true")

    def _model_entry_configured(self, entry_id: str) -> bool:
        return bool(self._setting(model_secret_key(entry_id)))

    def _model_entry_public(self, entry: dict[str, Any]) -> dict[str, Any]:
        return {
            "id": entry["id"],
            "kind": entry["kind"],
            "provider": entry.get("provider") or "",
            "api_base": entry.get("api_base") or "",
            "model": entry.get("model") or "",
            "display_name": entry.get("display_name") or entry.get("model") or "",
            "enabled": entry.get("enabled", True) is not False,
            "configured": self._model_entry_configured(entry["id"]),
        }

    def _primary_catalog_entry(self, kind: ModelKind) -> dict[str, Any] | None:
        catalog = self._read_model_catalog()
        items = catalog.get(kind, [])
        for entry in items:
            if entry.get("enabled", True) is False:
                continue
            if self._model_entry_configured(entry["id"]):
                return entry
        for entry in items:
            if entry.get("enabled", True) is not False:
                return entry
        return items[0] if items else None

    def _sync_legacy_model_fields(self, kind: ModelKind) -> None:
        entry = self._primary_catalog_entry(kind)
        if not entry:
            if kind == "llm":
                self._put_setting("chat_provider", "")
                self._put_setting("chat_base_url", "")
                self._put_setting("chat_model", "")
                self._put_setting("chat_api_key", "")
            else:
                self._put_setting("embed_provider", "")
                self._put_setting("embed_base_url", "")
                self._put_setting("embed_model", "")
                self._put_setting("embed_api_key", "")
            return
        secret = self._setting(model_secret_key(entry["id"])) or ""
        if kind == "llm":
            self._put_setting("chat_provider", entry.get("provider") or "")
            self._put_setting("chat_base_url", entry.get("api_base") or "")
            self._put_setting("chat_model", entry.get("model") or "")
            if secret:
                self._put_setting("chat_api_key", secret)
        else:
            self._put_setting("embed_provider", entry.get("provider") or "")
            self._put_setting("embed_base_url", entry.get("api_base") or "")
            self._put_setting("embed_model", entry.get("model") or "")
            if secret:
                self._put_setting("embed_api_key", secret)

    def list_configured_models(self, kind: ModelKind | None = None) -> list[dict[str, Any]]:
        with self._lock:
            catalog = self._read_model_catalog()
            if kind:
                return [self._model_entry_public(e) for e in catalog.get(kind, [])]
            out: list[dict[str, Any]] = []
            for bucket in ("llm", "embed"):
                out.extend(self._model_entry_public(e) for e in catalog.get(bucket, []))
            return out

    def add_configured_model(
        self,
        actor: User,
        kind: ModelKind,
        *,
        provider: str,
        api_base: str,
        model: str,
        api_key: str = "",
        display_name: str | None = None,
        enabled: bool = True,
    ) -> dict[str, Any]:
        _require_system_admin(actor)
        model_id = model.strip()
        if not model_id:
            raise AdminError(400, "model_required", "请填写模型 ID")
        base = api_base.strip()
        if not base:
            raise AdminError(400, "api_base_required", "请填写 Base URL")
        with self._lock:
            catalog = self._read_model_catalog()
            entry = new_entry(
                kind,
                provider=provider,
                api_base=base,
                model=model_id,
                display_name=display_name,
                enabled=enabled,
            )
            catalog[kind].append(entry)
            key = api_key.strip()
            if key:
                self._put_setting(model_secret_key(entry["id"]), key)
            self._write_model_catalog(catalog)
            self._sync_legacy_model_fields(kind)
            self._audit(
                actor.id,
                "model.added",
                "model",
                entry["id"],
                {"kind": kind, "model": model_id},
            )
            self._conn.commit()
            return self._model_entry_public(entry)

    def delete_configured_model(self, actor: User, entry_id: str) -> None:
        _require_system_admin(actor)
        with self._lock:
            catalog = self._read_model_catalog()
            found = find_entry(catalog, entry_id)
            if not found:
                raise AdminError(404, "model_not_found", "模型不存在")
            kind, index, _entry = found
            catalog[kind].pop(index)
            self._conn.execute("DELETE FROM settings WHERE key = ?", (model_secret_key(entry_id),))
            self._write_model_catalog(catalog)
            self._sync_legacy_model_fields(kind)
            self._audit(actor.id, "model.removed", "model", entry_id, {"kind": kind})
            self._conn.commit()

    def patch_configured_model(
        self,
        actor: User,
        entry_id: str,
        *,
        enabled: bool | None = None,
        api_key: str | None = None,
    ) -> dict[str, Any]:
        _require_system_admin(actor)
        with self._lock:
            catalog = self._read_model_catalog()
            found = find_entry(catalog, entry_id)
            if not found:
                raise AdminError(404, "model_not_found", "模型不存在")
            kind, index, entry = found
            if enabled is not None:
                entry["enabled"] = enabled
            if api_key is not None and api_key.strip():
                self._put_setting(model_secret_key(entry_id), api_key.strip())
            catalog[kind][index] = entry
            self._write_model_catalog(catalog)
            self._sync_legacy_model_fields(kind)
            self._audit(actor.id, "model.updated", "model", entry_id, {"kind": kind})
            self._conn.commit()
            return self._model_entry_public(entry)

    def get_chat_llm_settings(self) -> dict[str, str | None]:
        with self._lock:
            entry = self._primary_catalog_entry("llm")
            if entry:
                secret = self._setting(model_secret_key(entry["id"])) or ""
                return {
                    "base_url": entry.get("api_base") or "",
                    "model": entry.get("model") or "",
                    "api_key": secret,
                }
            return {
                "base_url": self._setting("chat_base_url") or "",
                "model": self._setting("chat_model") or "",
                "api_key": self._setting("chat_api_key") or "",
            }

    def get_embed_settings(self, model_id: str | None = None) -> dict[str, str | None]:
        with self._lock:
            entry: dict[str, Any] | None = None
            if model_id:
                found = find_entry(self._read_model_catalog(), model_id)
                if found and found[0] == "embed":
                    entry = found[2]
            else:
                entry = self._primary_catalog_entry("embed")
            if entry:
                secret = self._setting(model_secret_key(entry["id"])) or ""
                return {
                    "id": entry["id"],
                    "base_url": entry.get("api_base") or "",
                    "model": entry.get("model") or "",
                    "api_key": secret,
                }
            if model_id:
                raise AdminError(422, "embedding_model_not_found", "指定的嵌入模型不存在")
            return {
                "id": None,
                "base_url": self._setting("embed_base_url") or "",
                "model": self._setting("embed_model") or "",
                "api_key": self._setting("embed_api_key") or "",
            }

    def get_stored_model_api_key(self, kind: str) -> str:
        with self._lock:
            entry = self._primary_catalog_entry("llm" if kind != "embed" else "embed")
            if entry:
                return self._setting(model_secret_key(entry["id"])) or ""
            if kind == "embed":
                return self._setting("embed_api_key") or ""
            return self._setting("chat_api_key") or ""

    def get_stored_model_api_key_for_probe(self, kind: str, provider: str, api_base: str) -> str:
        with self._lock:
            catalog = self._read_model_catalog()
            base_norm = api_base.strip().rstrip("/").lower()
            for entry in catalog.get(kind, []):
                if (entry.get("provider") or "") != provider:
                    continue
                entry_base = (entry.get("api_base") or "").strip().rstrip("/").lower()
                if entry_base and base_norm and entry_base != base_norm:
                    continue
                secret = self._setting(model_secret_key(entry["id"]))
                if secret:
                    return secret
            if kind == "embed":
                return self._setting("embed_api_key") or ""
            return self._setting("chat_api_key") or ""

    def get_settings(self) -> dict[str, Any]:
        with self._lock:
            chat_key = self._setting("chat_api_key")
            embed_key = self._setting("embed_api_key")
            return {
                "open_registration": self._setting("open_registration") == "true",
                "chat_provider": self._setting("chat_provider") or "",
                "chat_base_url": self._setting("chat_base_url") or "",
                "chat_model": self._setting("chat_model") or "",
                "has_chat_key": bool(chat_key),
                "embed_provider": self._setting("embed_provider") or "",
                "embed_base_url": self._setting("embed_base_url") or "",
                "embed_model": self._setting("embed_model") or "",
                "has_embed_key": bool(embed_key),
            }

    def update_settings(self, actor: User, values: dict[str, Any]) -> dict[str, Any]:
        _require_system_admin(actor)
        with self._lock:
            if "open_registration" in values and values["open_registration"] is not None:
                self._put_setting(
                    "open_registration", "true" if values["open_registration"] else "false"
                )
            for key in (
                "chat_provider",
                "chat_base_url",
                "chat_model",
                "embed_provider",
                "embed_base_url",
                "embed_model",
            ):
                if key in values and values[key] is not None:
                    self._put_setting(key, str(values[key]).strip())
            for key in ("chat_api_key", "embed_api_key"):
                secret = values.get(key)
                if isinstance(secret, str) and secret.strip():
                    self._put_setting(key, secret.strip())
            self._audit(actor.id, "settings.updated", "settings", None, {"keys": sorted(values)})
            self._conn.commit()
            chat_key = self._setting("chat_api_key")
            embed_key = self._setting("embed_api_key")
            view = {
                "open_registration": self._setting("open_registration") == "true",
                "chat_provider": self._setting("chat_provider") or "",
                "chat_base_url": self._setting("chat_base_url") or "",
                "chat_model": self._setting("chat_model") or "",
                "has_chat_key": bool(chat_key),
                "embed_provider": self._setting("embed_provider") or "",
                "embed_base_url": self._setting("embed_base_url") or "",
                "embed_model": self._setting("embed_model") or "",
                "has_embed_key": bool(embed_key),
            }
        return view

    def list_audit(
        self,
        limit: int = 100,
        *,
        action_prefix: str | None = None,
    ) -> list[dict[str, Any]]:
        limit = min(max(1, limit), 200)
        clauses: list[str] = []
        params: list[Any] = []
        if action_prefix:
            clauses.append("action LIKE ?")
            params.append(f"{action_prefix}%")
        where = f"WHERE {' AND '.join(clauses)} " if clauses else ""
        params.append(limit)
        with self._lock:
            rows = self._conn.execute(
                f"SELECT * FROM audit_log {where}ORDER BY id DESC LIMIT ?",
                tuple(params),
            ).fetchall()
        return [self._audit_row_to_dict(row) for row in rows]

    def list_audit_for_kb(
        self,
        kb_id: str,
        *,
        action_prefix: str | None = None,
        limit: int = 50,
    ) -> list[dict[str, Any]]:
        limit = min(max(1, limit), 200)
        kb_detail_expr = (
            "(detail::jsonb ->> 'kb_id') = ?"
            if self._db.backend == "postgres"
            else "json_extract(detail, '$.kb_id') = ?"
        )
        clauses = [kb_detail_expr]
        params: list[Any] = [kb_id]
        if action_prefix:
            clauses.append("action LIKE ?")
            params.append(f"{action_prefix}%")
        params.append(limit)
        sql = f"""
            SELECT * FROM audit_log
            WHERE {' AND '.join(clauses)}
            ORDER BY id DESC
            LIMIT ?
        """
        with self._lock:
            rows = self._conn.execute(sql, params).fetchall()
        return [self._audit_row_to_dict(row) for row in rows]

    def record_audit(
        self,
        actor_id: str | None,
        action: str,
        target_type: str,
        target_id: str | None,
        detail: dict[str, Any] | None = None,
    ) -> None:
        payload = dict(detail or {})
        from sema.observability.request_context import current_request_id

        rid = current_request_id()
        if rid and "request_id" not in payload:
            payload["request_id"] = rid
        with self._lock:
            self._audit(actor_id, action, target_type, target_id, payload)
            self._conn.commit()

    @staticmethod
    def _audit_row_to_dict(row: sqlite3.Row) -> dict[str, Any]:
        return {
            "id": row["id"],
            "actor_id": row["actor_id"],
            "action": row["action"],
            "target_type": row["target_type"],
            "target_id": row["target_id"],
            "detail": json.loads(row["detail"]),
            "created_at": row["created_at"],
        }

    def _insert_user(self, email: str, password: str, display_name: str, *, is_admin: bool) -> User:
        user_id = str(uuid.uuid4())
        created_at = _now()
        self._conn.execute(
            """
            INSERT INTO users(id, email, display_name, password_hash, is_admin, created_at)
            VALUES (?, ?, ?, ?, ?, ?)
            """,
            (user_id, email, display_name, hash_password(password), int(is_admin), created_at),
        )
        return User(user_id, email, display_name, is_admin, None, created_at)

    def _issue_token(self, user_id: str) -> str:
        token = secrets_token()
        self._conn.execute(
            "INSERT INTO tokens(token_hash, user_id, created_at) VALUES (?, ?, ?)",
            (hash_token(token), user_id, _now()),
        )
        return token

    def _insert_kb(self, name: str, description: str, visibility: str, created_by: str) -> str:
        kb_id = str(uuid.uuid4())
        self._conn.execute(
            """
            INSERT INTO knowledge_bases(id, name, description, visibility, created_by, created_at)
            VALUES (?, ?, ?, ?, ?, ?)
            """,
            (kb_id, name, description, visibility, created_by, _now()),
        )
        return kb_id

    def _set_member(self, kb_id: str, user_id: str, role: str, added_by: str | None) -> None:
        self._conn.execute(
            """
            INSERT INTO kb_members(kb_id, user_id, role, added_by, joined_at)
            VALUES (?, ?, ?, ?, ?)
            ON CONFLICT(kb_id, user_id) DO UPDATE SET role = excluded.role
            """,
            (kb_id, user_id, role, added_by, _now()),
        )

    def _access_role(self, user: User, kb: KnowledgeBase) -> str | None:
        member = self._member_role(kb.id, user.id)
        if member == "owner":
            return "owner"
        if user.is_admin:
            return "admin"
        if member:
            return member
        if kb.visibility == "open":
            return "viewer"
        return None

    def _member_role(self, kb_id: str, user_id: str) -> str | None:
        row = self._conn.execute(
            "SELECT role FROM kb_members WHERE kb_id = ? AND user_id = ?",
            (kb_id, user_id),
        ).fetchone()
        return row["role"] if row else None

    def _owner_count(self, kb_id: str) -> int:
        return self._conn.execute(
            "SELECT COUNT(*) AS n FROM kb_members WHERE kb_id = ? AND role = 'owner'",
            (kb_id,),
        ).fetchone()["n"]

    def _active_admin_count(self) -> int:
        return self._conn.execute(
            "SELECT COUNT(*) AS n FROM users WHERE is_admin = 1 AND deactivated_at IS NULL"
        ).fetchone()["n"]

    def _active_by_email(self, email: str) -> sqlite3.Row | None:
        return self._conn.execute(
            "SELECT * FROM users WHERE email = ? AND deactivated_at IS NULL", (email,)
        ).fetchone()

    def _user(self, user_id: str) -> sqlite3.Row | None:
        return self._conn.execute("SELECT * FROM users WHERE id = ?", (user_id,)).fetchone()

    def _kb_row(self, kb_id: str) -> sqlite3.Row | None:
        return self._conn.execute(
            "SELECT * FROM knowledge_bases WHERE id = ?", (kb_id,)
        ).fetchone()

    def _api_token_row(self, token_id: str) -> sqlite3.Row | None:
        return self._conn.execute(
            "SELECT * FROM api_tokens WHERE id = ?", (token_id,)
        ).fetchone()

    def _setting(self, key: str) -> str | None:
        row = self._conn.execute("SELECT value FROM settings WHERE key = ?", (key,)).fetchone()
        return row["value"] if row else None

    def _put_setting(self, key: str, value: str) -> None:
        self._conn.execute(
            "INSERT INTO settings(key, value) VALUES (?, ?) ON CONFLICT(key) DO UPDATE SET value = excluded.value",
            (key, value),
        )

    def _audit(
        self,
        actor_id: str | None,
        action: str,
        target_type: str,
        target_id: str | None,
        detail: dict[str, Any],
    ) -> None:
        self._conn.execute(
            """
            INSERT INTO audit_log(actor_id, action, target_type, target_id, detail, created_at)
            VALUES (?, ?, ?, ?, ?, ?)
            """,
            (actor_id, action, target_type, target_id, json.dumps(detail, ensure_ascii=False), _now()),
        )


def secrets_token() -> str:
    from sema.admin.passwords import new_token

    return new_token()


def _user_from_row(row: sqlite3.Row) -> User:
    return User(
        id=row["id"],
        email=row["email"],
        display_name=row["display_name"],
        is_admin=bool(row["is_admin"]),
        deactivated_at=row["deactivated_at"],
        created_at=row["created_at"],
    )


def _kb_from_row(row: sqlite3.Row) -> KnowledgeBase:
    return KnowledgeBase(
        id=row["id"],
        name=row["name"],
        description=row["description"],
        visibility=row["visibility"],
        created_by=row["created_by"],
        created_at=row["created_at"],
    )


def _api_token_from_row(row: sqlite3.Row) -> ApiTokenRecord:
    kb_ids = json.loads(row["kb_ids_json"] or "[]")
    if not isinstance(kb_ids, list):
        kb_ids = []
    secret = row["token_secret"] if "token_secret" in row.keys() else None
    return ApiTokenRecord(
        id=row["id"],
        user_id=row["user_id"],
        name=row["name"],
        scope=row["scope"],
        kb_ids=tuple(str(x) for x in kb_ids),
        created_at=row["created_at"],
        expires_at=row["expires_at"],
        last_used_at=row["last_used_at"],
        revoked_at=row["revoked_at"],
        token_secret=secret,
    )


def _require_system_admin(user: User) -> None:
    if not user.is_admin:
        raise AdminError(403, "forbidden", "需要系统管理员")


def _clean_email(email: str) -> str:
    email = email.strip().lower()
    if "@" not in email or len(email) > 254:
        raise AdminError(422, "bad_email", "邮箱格式不正确")
    return email


def _clean_name(value: str, label: str) -> str:
    value = value.strip()
    if not value or len(value) > 64:
        raise AdminError(422, "bad_name", f"{label}需要 1 到 64 个字符")
    return value


def _check_password(password: str) -> None:
    if len(password) < 8:
        raise AdminError(422, "password_too_short", "密码至少 8 位")


def _visibility(value: str) -> str:
    if value not in {"open", "restricted"}:
        raise AdminError(422, "bad_visibility", "可见性必须是 open 或 restricted")
    return value


def _touches_owner(current: str | None, new_role: str) -> bool:
    return new_role == "owner" or current == "owner"
