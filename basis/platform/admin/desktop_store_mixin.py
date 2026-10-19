"""Desktop profile persistence (ADR 0004)."""

from __future__ import annotations

from typing import TYPE_CHECKING

from basis.platform.admin.passwords import hash_password
from basis.platform.admin.org_store import secrets_token

if TYPE_CHECKING:
    from basis.platform.admin.store import User

DESKTOP_USER_ID = "basis-desktop-local"
DESKTOP_EMAIL = "local@basis.desktop"
DESKTOP_DISPLAY_NAME = "Local"


class DesktopStoreMixin:
    def commit_transaction(self) -> None:
        with self._lock:
            self._conn.commit()

    def ensure_desktop_principal(self) -> "User":
        """Create or return the single desktop user and ensure a default KB exists."""
        from basis.platform.admin.store import _user_from_row

        existing = self.get_user_by_id(DESKTOP_USER_ID)
        if existing is not None:
            self._ensure_desktop_default_kb(existing.id)
            return existing
        password = secrets_token()
        with self._lock:
            row = self._user(DESKTOP_USER_ID)
            if row is not None:
                user = _user_from_row(row)
                self._ensure_desktop_default_kb(user.id)
                self._conn.commit()
                return user
            from basis.platform.admin.store import _now

            created_at = _now()
            self._conn.execute(
                """
                INSERT INTO users(id, email, display_name, password_hash, is_admin, created_at)
                VALUES (?, ?, ?, ?, ?, ?)
                """,
                (
                    DESKTOP_USER_ID,
                    DESKTOP_EMAIL,
                    DESKTOP_DISPLAY_NAME,
                    hash_password(password),
                    1,
                    created_at,
                ),
            )
            org = self._create_organization("本地知识库", owner_user_id=DESKTOP_USER_ID)
            kb_id = self._insert_kb(
                "本地知识库",
                "",
                "restricted",
                DESKTOP_USER_ID,
                org.id,
            )
            self._set_member(kb_id, DESKTOP_USER_ID, "owner", DESKTOP_USER_ID)
            self._audit(
                DESKTOP_USER_ID,
                "auth.desktop_bootstrap",
                "user",
                DESKTOP_USER_ID,
                {"email": DESKTOP_EMAIL},
            )
            self._conn.commit()
        user = self.get_user_by_id(DESKTOP_USER_ID)
        assert user is not None
        return user

    def _ensure_desktop_default_kb(self, user_id: str) -> None:
        with self._lock:
            row = self._conn.execute("SELECT COUNT(*) AS n FROM knowledge_bases").fetchone()
            if row and int(row["n"]) > 0:
                return
            org = self._create_organization("本地知识库", owner_user_id=user_id)
            kb_id = self._insert_kb("本地知识库", "", "restricted", user_id, org.id)
            self._set_member(kb_id, user_id, "owner", user_id)

    def issue_desktop_session_token(self, user: "User") -> str:
        with self._lock:
            token = self._issue_token(user.id)
            self._conn.commit()
        return token

    def ensure_oauth_state_secret(self) -> str:
        from basis.platform.admin.passwords import new_token

        with self._lock:
            existing = self._setting("auth_oauth_state_secret")
            if existing and existing.strip():
                return existing.strip()
            secret = new_token()
            self._put_setting("auth_oauth_state_secret", secret)
            self._conn.commit()
            return secret
