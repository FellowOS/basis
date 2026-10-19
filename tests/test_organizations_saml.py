from pathlib import Path

from fastapi.testclient import TestClient

from basis.infra.config import Settings
from basis.platform.admin.store import AdminStore
from basis.platform.auth.saml_capabilities import saml_sp_available
from basis.transport.http.app import create_app

_SAMPLE_CERT = """-----BEGIN CERTIFICATE-----
MIIBkTCB+wIJAKHBfpEWqJzTMA0GCSqGSIb3DQEBCwUAMBQxEjAQBgNVBAMMCWxv
Y2FsaG9zdDAeFw0yNTAxMDEwMDAwMDBaFw00NTAxMDEwMDAwMDBaMBQxEjAQBgNV
BAMMCWxvY2FsaG9zdDBZMBMGByqGSM49AgEGCCqGSM49AwEHA0IABDummyCertFor
TestsOnlyNotValid==
-----END CERTIFICATE-----"""


def _store(tmp_path: Path) -> AdminStore:
    return AdminStore(tmp_path / "basis.db")


def test_org_saml_upsert_and_domain_resolve(tmp_path: Path) -> None:
    admin = _store(tmp_path)
    user, _ = admin.register("saml@example.com", "password1", "Saml")
    kb = admin.create_kb(user, "Saml Co", None, "restricted")
    org_id = kb.organization_id
    assert org_id
    admin.upsert_org_saml_config(
        user,
        org_id,
        idp_entity_id="https://idp.example.com/metadata",
        idp_sso_url="https://idp.example.com/sso",
        idp_x509_cert=_SAMPLE_CERT,
        email_domains=["samlco.com"],
    )
    cfg = admin.get_org_saml_config(org_id)
    assert cfg is not None
    assert cfg["idp_entity_id"].startswith("https://")
    match = admin.resolve_org_sso_for_email("user@samlco.com")
    assert match is not None
    assert match[1] == "saml"
    admin.close()


def test_org_sso_options_includes_saml(tmp_path: Path) -> None:
    admin = _store(tmp_path)
    user, _ = admin.register("opts2@example.com", "password1", "Opts2")
    kb = admin.create_kb(user, "Saml Opts", None, "restricted")
    org_id = kb.organization_id
    assert org_id
    admin.upsert_org_saml_config(
        user,
        org_id,
        idp_entity_id="https://idp.example.com/metadata",
        idp_sso_url="https://idp.example.com/sso",
        idp_x509_cert=_SAMPLE_CERT,
        email_domains=["samlopts.com"],
        enabled=True,
    )
    admin.close()

    client = TestClient(create_app(Settings(data_dir=tmp_path)))
    res = client.get("/api/v1/auth/org-sso-options")
    assert res.status_code == 200
    options = res.json()["options"]
    saml_opts = [o for o in options if o.get("protocol") == "saml"]
    assert len(saml_opts) == 1
    assert "/api/v1/auth/saml/" in saml_opts[0]["login_path"]


def test_org_saml_start_when_library_missing(tmp_path: Path) -> None:
    admin = _store(tmp_path)
    user, _ = admin.register("start@example.com", "password1", "Start")
    kb = admin.create_kb(user, "Start SAML", None, "restricted")
    org_id = kb.organization_id
    assert org_id
    org = admin.get_org_by_id(org_id)
    admin.upsert_org_saml_config(
        user,
        org_id,
        idp_entity_id="https://idp.example.com/metadata",
        idp_sso_url="https://idp.example.com/sso",
        idp_x509_cert=_SAMPLE_CERT,
    )
    admin.close()

    client = TestClient(create_app(Settings(data_dir=tmp_path)))
    res = client.get(f"/api/v1/auth/saml/{org.slug}/start", follow_redirects=False)
    if saml_sp_available():
        assert res.status_code in (302, 307)
    else:
        assert res.status_code == 503
