"""Desktop profile: fixed local principal (ADR 0004)."""

from __future__ import annotations

from basis.platform.admin.passwords import hash_password
from basis.platform.admin.org_store import secrets_token
from basis.platform.admin.store import AdminStore, User, _user_from_row

DESKTOP_USER_ID = "basis-desktop-local"
DESKTOP_EMAIL = "local@basis.desktop"
DESKTOP_DISPLAY_NAME = "Local"


def ensure_desktop_principal(store: AdminStore) -> User:
    """Create or return the single desktop user and ensure a default KB exists."""
    existing = store.get_user_by_id(DESKTOP_USER_ID)
    if existing is not None:
        _ensure_default_kb(store, existing.id)
        return existing
    password = secrets_token()
    with store._lock:
        row = store._user(DESKTOP_USER_ID)
        if row is not None:
            user = _user_from_row(row)
            _ensure_default_kb(store, user.id)
            store._conn.commit()
            return user
        from basis.platform.admin.store import _now

        created_at = _now()
        store._conn.execute(
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
        org = store._create_organization("本地知识库", owner_user_id=DESKTOP_USER_ID)
        kb_id = store._insert_kb(
            "本地知识库",
            "",
            "restricted",
            DESKTOP_USER_ID,
            org.id,
        )
        store._set_member(kb_id, DESKTOP_USER_ID, "owner", DESKTOP_USER_ID)
        store._audit(
            DESKTOP_USER_ID,
            "auth.desktop_bootstrap",
            "user",
            DESKTOP_USER_ID,
            {"email": DESKTOP_EMAIL},
        )
        store._conn.commit()
    user = store.get_user_by_id(DESKTOP_USER_ID)
    assert user is not None
    return user


def _ensure_default_kb(store: AdminStore, user_id: str) -> None:
    with store._lock:
        row = store._conn.execute("SELECT COUNT(*) AS n FROM knowledge_bases").fetchone()
        if row and int(row["n"]) > 0:
            return
        org = store._create_organization("本地知识库", owner_user_id=user_id)
        kb_id = store._insert_kb("本地知识库", "", "restricted", user_id, org.id)
        store._set_member(kb_id, user_id, "owner", user_id)


def issue_desktop_session_token(store: AdminStore, user: User) -> str:
    with store._lock:
        token = store._issue_token(user.id)
        store._conn.commit()
    return token
