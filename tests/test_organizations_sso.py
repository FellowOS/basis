from pathlib import Path

from basis.platform.admin.store import AdminStore
def _store(tmp_path: Path) -> AdminStore:
    return AdminStore(tmp_path / "basis.db")


def test_kb_backfill_creates_organization(tmp_path: Path) -> None:
    admin = _store(tmp_path)
    user, _ = admin.register("o@example.com", "password1", "Owner")
    kb = admin.create_kb(user, "Demo KB", None, "restricted")
    assert kb.organization_id
    org = admin.get_org_by_id(kb.organization_id or "")
    assert org is not None
    assert admin.org_role(org.id, user.id) == "owner"
    admin.close()


def test_org_oidc_upsert_and_slug_login_path(tmp_path: Path) -> None:
    admin = _store(tmp_path)
    user, _ = admin.register("admin@example.com", "password1", "Admin")
    kb = admin.create_kb(user, "Acme", None, "restricted")
    org_id = kb.organization_id
    assert org_id
    admin.upsert_org_oidc_config(
        user,
        org_id,
        issuer="http://localhost:9000/application/o/basis/",
        client_id="cid",
        client_secret="secret",
        email_domains=["acme.com"],
    )
    cfg = admin.get_org_oidc_config(org_id)
    assert cfg is not None
    assert cfg["client_id"] == "cid"
    org = admin.get_org_by_id(org_id)
    assert org is not None
    resolved = admin.resolve_org_by_email_domain("user@acme.com")
    assert resolved is not None
    assert resolved.id == org_id
    admin.close()


def test_magic_link_login(tmp_path: Path) -> None:
    admin = _store(tmp_path)
    token = admin.create_magic_link("magic@example.com")
    user, session = admin.consume_magic_link(token)
    assert user.email == "magic@example.com"
    assert admin.user_by_token(session) is not None
    admin.close()
