"""Organizations, org SSO config, federated identities, magic links."""

from __future__ import annotations

import json
import uuid
from dataclasses import dataclass
from datetime import datetime, timedelta, timezone
from typing import Any

from basis.platform.admin.errors import AdminError
from basis.platform.auth.org_login_policy import ORG_AUTH_POLICIES
from basis.platform.admin.org_backfill import _slug_for_kb, parse_email_domains
from basis.platform.admin.passwords import hash_password, hash_token, new_token
from basis.platform.admin import validators as field_validators

if False:  # TYPE_CHECKING without importing store (avoid cycle)
    from basis.platform.admin.store import User

def _now() -> str:
    from datetime import datetime, timezone
    return datetime.now(timezone.utc).isoformat()


def secrets_token() -> str:
    from basis.platform.admin.passwords import new_token
    return new_token()

ORG_ROLES = frozenset({"owner", "admin", "member"})
ORG_ROLE_RANK = {"member": 1, "admin": 2, "owner": 3}


@dataclass(frozen=True)
class Organization:
    id: str
    name: str
    slug: str
    auth_policy: str
    created_at: str

    def public(self) -> dict[str, Any]:
        return {
            "id": self.id,
            "name": self.name,
            "slug": self.slug,
            "auth_policy": self.auth_policy,
            "created_at": self.created_at,
        }


class OrganizationAuthMixin:
    """Mixed into AdminStore."""

    def _create_organization(
        self,
        name: str,
        *,
        slug: str | None = None,
        owner_user_id: str | None = None,
    ) -> Organization:
        org_id = str(uuid.uuid4())
        org_name = field_validators.clean_name(name, "组织名称")
        slug_value = (slug or f"org-{org_id[:8]}").strip().lower()
        if not slug_value or len(slug_value) > 64:
            slug_value = f"org-{org_id[:8]}"
        created_at = _now()
        with self._lock:
            if self._conn.execute(
                "SELECT 1 FROM organizations WHERE slug = ?", (slug_value,)
            ).fetchone():
                slug_value = f"{slug_value}-{org_id[:6]}"
            self._conn.execute(
                """
                INSERT INTO organizations(id, name, slug, auth_policy, created_at)
                VALUES (?, ?, ?, 'password_allowed', ?)
                """,
                (org_id, org_name, slug_value, created_at),
            )
            if owner_user_id:
                self._conn.execute(
                    """
                    INSERT INTO org_members(organization_id, user_id, role, joined_at)
                    VALUES (?, ?, 'owner', ?)
                    """,
                    (org_id, owner_user_id, created_at),
                )
            row = self._conn.execute(
                "SELECT * FROM organizations WHERE id = ?", (org_id,)
            ).fetchone()
        return _org_from_row(row)

    def list_orgs_for_user(self, user_id: str) -> list[Organization]:
        with self._lock:
            rows = self._conn.execute(
                """
                SELECT o.* FROM organizations o
                JOIN org_members m ON m.organization_id = o.id
                WHERE m.user_id = ?
                ORDER BY o.created_at
                """,
                (user_id,),
            ).fetchall()
        return [_org_from_row(r) for r in rows]

    def list_all_organizations(self) -> list[Organization]:
        with self._lock:
            rows = self._conn.execute(
                "SELECT * FROM organizations ORDER BY created_at",
            ).fetchall()
        return [_org_from_row(r) for r in rows]

    def _db_backend(self) -> str:
        db = getattr(self, "_db", None)
        return getattr(db, "backend", "sqlite")

    def ensure_knowledge_bases_organization_column(self) -> None:
        """Add knowledge_bases.organization_id when migration ALTER was skipped (e.g. PG privileges)."""
        with self._lock:
            if self._db_backend() == "postgres":
                row = self._conn.execute(
                    """
                    SELECT EXISTS (
                        SELECT 1 FROM information_schema.columns
                        WHERE table_schema = 'public'
                          AND table_name = 'knowledge_bases'
                          AND column_name = 'organization_id'
                    )
                    """
                ).fetchone()
                if row and row[0]:
                    return
                try:
                    self._conn.execute(
                        """
                        ALTER TABLE knowledge_bases
                        ADD COLUMN IF NOT EXISTS organization_id TEXT
                        REFERENCES organizations(id)
                        """
                    )
                    self._conn.commit()
                except Exception:
                    try:
                        self._conn.execute(
                            """
                            ALTER TABLE knowledge_bases
                            ADD COLUMN IF NOT EXISTS organization_id TEXT
                            """
                        )
                        self._conn.commit()
                    except Exception:
                        pass
                return
            cols = {
                r[1]
                for r in self._conn.execute("PRAGMA table_info(knowledge_bases)").fetchall()
            }
            if "organization_id" in cols:
                return
            try:
                self._conn.execute(
                    """
                    ALTER TABLE knowledge_bases
                    ADD COLUMN organization_id TEXT REFERENCES organizations(id)
                    """
                )
                self._conn.commit()
            except Exception:
                pass

    def ensure_kb_organization_links(self) -> int:
        """Create an organization for each KB missing organization_id (idempotent)."""
        with self._lock:
            try:
                pending = self._conn.execute(
                    """
                    SELECT id, name, created_by FROM knowledge_bases
                    WHERE organization_id IS NULL OR TRIM(organization_id) = ''
                    """
                ).fetchall()
            except Exception:
                return 0
            if not pending:
                return 0
            count = 0
            now = _now()
            for kb in pending:
                kb_id = kb["id"]
                org_id = str(uuid.uuid4())
                slug = _slug_for_kb(kb_id, kb["name"] or "org")
                while self._conn.execute(
                    "SELECT 1 FROM organizations WHERE slug = ?", (slug,)
                ).fetchone():
                    slug = f"{slug}-{org_id[:6]}"
                self._conn.execute(
                    """
                    INSERT INTO organizations(id, name, slug, auth_policy, created_at)
                    VALUES (?, ?, ?, 'password_allowed', ?)
                    """,
                    (org_id, kb["name"] or "Organization", slug, now),
                )
                owners = self._conn.execute(
                    """
                    SELECT user_id FROM kb_members
                    WHERE kb_id = ? AND role = 'owner'
                    """,
                    (kb_id,),
                ).fetchall()
                member_ids = {kb["created_by"]}
                for o in owners:
                    member_ids.add(o["user_id"])
                for uid in member_ids:
                    if not uid:
                        continue
                    self._conn.execute(
                        """
                        INSERT OR IGNORE INTO org_members(organization_id, user_id, role, joined_at)
                        VALUES (?, ?, 'owner', ?)
                        """,
                        (org_id, uid, now),
                    )
                self._conn.execute(
                    "UPDATE knowledge_bases SET organization_id = ? WHERE id = ?",
                    (org_id, kb_id),
                )
                count += 1
            if count:
                self._conn.commit()
            return count

    def reconcile_organization_memberships(self) -> None:
        """KB owner/admin → org owner/admin on the KB's organization."""
        with self._lock:
            try:
                rows = self._conn.execute(
                    """
                    SELECT kb.organization_id AS org_id, m.user_id, m.role AS kb_role
                    FROM kb_members m
                    INNER JOIN knowledge_bases kb ON kb.id = m.kb_id
                    WHERE kb.organization_id IS NOT NULL AND TRIM(kb.organization_id) != ''
                      AND m.role IN ('owner', 'admin')
                    """
                ).fetchall()
            except Exception:
                return
            if not rows:
                return
            now = _now()
            changed = False
            for row in rows:
                org_id = row["org_id"]
                user_id = row["user_id"]
                desired = "owner" if row["kb_role"] == "owner" else "admin"
                role_row = self._conn.execute(
                    """
                    SELECT role FROM org_members
                    WHERE organization_id = ? AND user_id = ?
                    """,
                    (org_id, user_id),
                ).fetchone()
                current = role_row["role"] if role_row else None
                if current is None:
                    self._conn.execute(
                        """
                        INSERT OR IGNORE INTO org_members(organization_id, user_id, role, joined_at)
                        VALUES (?, ?, ?, ?)
                        """,
                        (org_id, user_id, desired, now),
                    )
                    changed = True
                elif ORG_ROLE_RANK.get(desired, 0) > ORG_ROLE_RANK.get(current, 0):
                    self._conn.execute(
                        """
                        UPDATE org_members SET role = ?
                        WHERE organization_id = ? AND user_id = ?
                        """,
                        (desired, org_id, user_id),
                    )
                    changed = True
            if changed:
                self._conn.commit()

    def ensure_default_organization(self, actor: "User") -> Organization | None:
        if not actor.is_admin:
            return None
        if self.list_all_organizations():
            return None
        with self._lock:
            org = self._create_organization("默认组织", owner_user_id=actor.id)
            self._conn.commit()
        return org

    def prepare_organization_sso_directory(self, actor: "User | None" = None) -> None:
        self.ensure_knowledge_bases_organization_column()
        self.ensure_kb_organization_links()
        self.reconcile_organization_memberships()
        if actor is not None:
            self.ensure_default_organization(actor)

    def get_org_by_slug(self, slug: str) -> Organization | None:
        slug = slug.strip().lower()
        with self._lock:
            row = self._conn.execute(
                "SELECT * FROM organizations WHERE slug = ?", (slug,)
            ).fetchone()
        return _org_from_row(row) if row else None

    def get_org_by_id(self, org_id: str) -> Organization | None:
        with self._lock:
            row = self._conn.execute(
                "SELECT * FROM organizations WHERE id = ?", (org_id,)
            ).fetchone()
        return _org_from_row(row) if row else None

    def org_role(self, org_id: str, user_id: str) -> str | None:
        with self._lock:
            row = self._conn.execute(
                """
                SELECT role FROM org_members
                WHERE organization_id = ? AND user_id = ?
                """,
                (org_id, user_id),
            ).fetchone()
        return row["role"] if row else None

    def require_org_admin(self, actor: "User", org_id: str) -> str:
        if actor.is_admin:
            return "owner"
        role = self.org_role(org_id, actor.id)
        if role is None or ORG_ROLE_RANK.get(role, 0) < ORG_ROLE_RANK["admin"]:
            raise AdminError(403, "forbidden", "需要组织管理员")
        return role

    def _sso_domain_rows(self, table: str) -> list[Any]:
        with self._lock:
            try:
                return self._conn.execute(
                    f"""
                    SELECT o.*, c.email_domains_json, c.enabled
                    FROM {table} c
                    JOIN organizations o ON o.id = c.organization_id
                    WHERE c.enabled = 1
                    """
                ).fetchall()
            except Exception as exc:
                msg = str(exc).lower()
                if table in msg and ("does not exist" in msg or "no such table" in msg):
                    return []
                raise

    def resolve_org_sso_for_email(self, email: str) -> tuple[Organization, str] | None:
        """Return (organization, protocol) for ``oidc`` or ``saml`` domain match."""
        domain = email.split("@", 1)[-1].lower()
        oidc_match: Organization | None = None
        for row in self._sso_domain_rows("org_oidc_configs"):
            if domain in parse_email_domains(row["email_domains_json"]):
                oidc_match = _org_from_row(row)
                break
        if oidc_match is not None and self.get_org_oidc_config(oidc_match.id):
            return oidc_match, "oidc"
        saml_match: Organization | None = None
        for row in self._sso_domain_rows("org_saml_configs"):
            if domain in parse_email_domains(row["email_domains_json"]):
                saml_match = _org_from_row(row)
                break
        if saml_match is not None and self.get_org_saml_config(saml_match.id):
            return saml_match, "saml"
        if oidc_match is not None:
            return oidc_match, "oidc"
        return None

    def resolve_org_by_email_domain(self, email: str) -> Organization | None:
        match = self.resolve_org_sso_for_email(email)
        return match[0] if match else None

    def list_enabled_org_sso_public(self) -> list[Organization]:
        """Orgs with enabled OIDC or SAML (public login discovery; no secrets)."""
        seen: set[str] = set()
        orgs: list[Organization] = []
        with self._lock:
            queries = (
                """
                SELECT o.*
                FROM org_oidc_configs c
                JOIN organizations o ON o.id = c.organization_id
                WHERE c.enabled = 1
                ORDER BY o.name ASC
                """,
                """
                SELECT o.*
                FROM org_saml_configs c
                JOIN organizations o ON o.id = c.organization_id
                WHERE c.enabled = 1
                ORDER BY o.name ASC
                """,
            )
            for sql in queries:
                try:
                    rows = self._conn.execute(sql).fetchall()
                except Exception as exc:
                    msg = str(exc).lower()
                    if "no such table" in msg or "does not exist" in msg:
                        continue
                    raise
                for row in rows:
                    org = _org_from_row(row)
                    if org.id in seen:
                        continue
                    seen.add(org.id)
                    orgs.append(org)
        return sorted(orgs, key=lambda o: o.name.lower())

    def _org_oidc_row_to_dict(self, row: Any) -> dict[str, Any]:
        return {
            "organization_id": row["organization_id"],
            "issuer": row["issuer"].rstrip("/"),
            "client_id": row["client_id"],
            "client_secret": row["client_secret"],
            "scopes": row["scopes"] or "openid email profile",
            "email_domains": parse_email_domains(row["email_domains_json"]),
            "enabled": bool(row["enabled"]),
        }

    def get_org_oidc_settings(self, org_id: str) -> dict[str, Any] | None:
        """OIDC row for org admins (includes disabled configs)."""
        with self._lock:
            row = self._conn.execute(
                "SELECT * FROM org_oidc_configs WHERE organization_id = ?",
                (org_id,),
            ).fetchone()
        if row is None:
            return None
        return self._org_oidc_row_to_dict(row)

    def get_org_oidc_config(self, org_id: str) -> dict[str, Any] | None:
        cfg = self.get_org_oidc_settings(org_id)
        if cfg is None or not cfg["enabled"]:
            return None
        return cfg

    def upsert_org_oidc_config(
        self,
        actor: "User",
        org_id: str,
        *,
        issuer: str,
        client_id: str,
        client_secret: str,
        scopes: str = "openid email profile",
        email_domains: list[str] | None = None,
        enabled: bool = True,
        auth_policy: str | None = None,
    ) -> dict[str, Any]:
        self.require_org_admin(actor, org_id)
        if auth_policy is not None and auth_policy not in ORG_AUTH_POLICIES:
            raise AdminError(422, "bad_auth_policy", "auth_policy 无效")
        issuer = issuer.strip().rstrip("/")
        if not issuer.startswith("http"):
            raise AdminError(422, "bad_issuer", "Issuer 必须是 URL")
        domains = [d.strip().lower() for d in (email_domains or []) if d.strip()]
        secret = client_secret.strip()
        now = _now()
        with self._lock:
            if self.get_org_by_id(org_id) is None:
                raise AdminError(404, "not_found", "组织不存在")
            if not secret:
                existing = self.get_org_oidc_settings(org_id)
                if existing is None:
                    raise AdminError(422, "missing_secret", "Client secret 不能为空")
                secret = existing["client_secret"]
            self._conn.execute(
                """
                INSERT INTO org_oidc_configs(
                    organization_id, issuer, client_id, client_secret, scopes,
                    email_domains_json, enabled, created_at, updated_at
                ) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?)
                ON CONFLICT(organization_id) DO UPDATE SET
                    issuer = excluded.issuer,
                    client_id = excluded.client_id,
                    client_secret = excluded.client_secret,
                    scopes = excluded.scopes,
                    email_domains_json = excluded.email_domains_json,
                    enabled = excluded.enabled,
                    updated_at = excluded.updated_at
                """,
                (
                    org_id,
                    issuer,
                    client_id,
                    secret,
                    scopes,
                    json.dumps(domains, ensure_ascii=False),
                    int(enabled),
                    now,
                    now,
                ),
            )
            if auth_policy is not None:
                self._conn.execute(
                    "UPDATE organizations SET auth_policy = ? WHERE id = ?",
                    (auth_policy, org_id),
                )
            self._audit(
                actor.id,
                "org.oidc_updated",
                "organization",
                org_id,
                {"issuer": issuer, "enabled": enabled, "auth_policy": auth_policy},
            )
            self._conn.commit()
        cfg = self.get_org_oidc_settings(org_id)
        assert cfg is not None
        return {k: v for k, v in cfg.items() if k != "client_secret"}

    def _org_saml_row_to_dict(self, row: Any, *, include_secrets: bool = False) -> dict[str, Any]:
        keys = set(row.keys()) if hasattr(row, "keys") else set()
        payload: dict[str, Any] = {
            "organization_id": row["organization_id"],
            "idp_entity_id": row["idp_entity_id"],
            "idp_sso_url": row["idp_sso_url"],
            "idp_x509_cert": row["idp_x509_cert"],
            "sp_entity_id": row["sp_entity_id"],
            "email_domains": parse_email_domains(row["email_domains_json"]),
            "enabled": bool(row["enabled"]),
            "authn_requests_signed": bool(row["authn_requests_signed"]) if "authn_requests_signed" in keys else False,
            "idp_slo_url": row["idp_slo_url"] if "idp_slo_url" in keys else None,
            "slo_enabled": bool(row["slo_enabled"]) if "slo_enabled" in keys else False,
        }
        sp_cert = row["sp_x509_cert"] if "sp_x509_cert" in keys else None
        sp_key = row["sp_private_key"] if "sp_private_key" in keys else None
        if include_secrets:
            payload["sp_x509_cert"] = sp_cert
            payload["sp_private_key"] = sp_key
        else:
            payload["sp_signing_configured"] = bool(sp_cert and sp_key)
        return payload

    def get_org_saml_settings(self, org_id: str) -> dict[str, Any] | None:
        with self._lock:
            try:
                row = self._conn.execute(
                    "SELECT * FROM org_saml_configs WHERE organization_id = ?",
                    (org_id,),
                ).fetchone()
            except Exception as exc:
                msg = str(exc).lower()
                if "org_saml_configs" in msg and (
                    "does not exist" in msg or "no such table" in msg
                ):
                    return None
                raise
        if row is None:
            return None
        return self._org_saml_row_to_dict(row)

    def get_org_saml_runtime_config(self, org_id: str) -> dict[str, Any] | None:
        """Enabled SAML config including SP private key for AuthnRequest signing."""
        with self._lock:
            try:
                row = self._conn.execute(
                    "SELECT * FROM org_saml_configs WHERE organization_id = ?",
                    (org_id,),
                ).fetchone()
            except Exception as exc:
                msg = str(exc).lower()
                if "org_saml_configs" in msg and (
                    "does not exist" in msg or "no such table" in msg
                ):
                    return None
                raise
        if row is None or not row["enabled"]:
            return None
        return self._org_saml_row_to_dict(row, include_secrets=True)

    def get_org_saml_config(self, org_id: str) -> dict[str, Any] | None:
        cfg = self.get_org_saml_runtime_config(org_id)
        return cfg

    def upsert_org_saml_config(
        self,
        actor: "User",
        org_id: str,
        *,
        idp_entity_id: str,
        idp_sso_url: str,
        idp_x509_cert: str,
        sp_entity_id: str | None = None,
        email_domains: list[str] | None = None,
        enabled: bool = True,
        auth_policy: str | None = None,
        authn_requests_signed: bool = False,
        sp_x509_cert: str = "",
        sp_private_key: str = "",
        idp_slo_url: str | None = None,
        slo_enabled: bool = False,
    ) -> dict[str, Any]:
        self.require_org_admin(actor, org_id)
        if auth_policy is not None and auth_policy not in ORG_AUTH_POLICIES:
            raise AdminError(422, "bad_auth_policy", "auth_policy 无效")
        entity_id = idp_entity_id.strip()
        sso_url = idp_sso_url.strip()
        if not entity_id:
            raise AdminError(422, "bad_idp_entity_id", "IdP Entity ID 不能为空")
        if not sso_url.startswith("http"):
            raise AdminError(422, "bad_idp_sso_url", "IdP SSO URL 必须是 URL")
        cert = idp_x509_cert.strip()
        domains = [d.strip().lower() for d in (email_domains or []) if d.strip()]
        now = _now()
        with self._lock:
            if self.get_org_by_id(org_id) is None:
                raise AdminError(404, "not_found", "组织不存在")
            existing_raw = self._conn.execute(
                "SELECT * FROM org_saml_configs WHERE organization_id = ?",
                (org_id,),
            ).fetchone()
            if not cert:
                if existing_raw is None:
                    raise AdminError(422, "missing_cert", "IdP x509 证书不能为空")
                cert = existing_raw["idp_x509_cert"]
            sp_override = (sp_entity_id or "").strip() or None
            sp_cert = sp_x509_cert.strip()
            sp_key = sp_private_key.strip()
            if not sp_cert and existing_raw is not None:
                sp_cert = (existing_raw["sp_x509_cert"] or "").strip()
            if not sp_key and existing_raw is not None:
                sp_key = (existing_raw["sp_private_key"] or "").strip()
            if authn_requests_signed and (not sp_cert or not sp_key):
                raise AdminError(
                    422,
                    "missing_sp_signing_material",
                    "启用签名 AuthnRequest 需配置 SP 证书与私钥",
                )
            slo_url = (idp_slo_url or "").strip()
            if existing_raw is not None and not slo_url and "idp_slo_url" in existing_raw.keys():
                slo_url = (existing_raw["idp_slo_url"] or "").strip()
            if slo_enabled and not slo_url.startswith("http"):
                raise AdminError(422, "bad_idp_slo_url", "启用 SLO 需配置有效的 IdP SLO URL")
            self._conn.execute(
                """
                INSERT INTO org_saml_configs(
                    organization_id, idp_entity_id, idp_sso_url, idp_x509_cert,
                    sp_entity_id, email_domains_json, enabled,
                    authn_requests_signed, sp_x509_cert, sp_private_key,
                    idp_slo_url, slo_enabled,
                    created_at, updated_at
                ) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)
                ON CONFLICT(organization_id) DO UPDATE SET
                    idp_entity_id = excluded.idp_entity_id,
                    idp_sso_url = excluded.idp_sso_url,
                    idp_x509_cert = excluded.idp_x509_cert,
                    sp_entity_id = excluded.sp_entity_id,
                    email_domains_json = excluded.email_domains_json,
                    enabled = excluded.enabled,
                    authn_requests_signed = excluded.authn_requests_signed,
                    sp_x509_cert = excluded.sp_x509_cert,
                    sp_private_key = excluded.sp_private_key,
                    idp_slo_url = excluded.idp_slo_url,
                    slo_enabled = excluded.slo_enabled,
                    updated_at = excluded.updated_at
                """,
                (
                    org_id,
                    entity_id,
                    sso_url,
                    cert,
                    sp_override,
                    json.dumps(domains, ensure_ascii=False),
                    int(enabled),
                    int(authn_requests_signed),
                    sp_cert or None,
                    sp_key or None,
                    slo_url or None,
                    int(slo_enabled),
                    now,
                    now,
                ),
            )
            if auth_policy is not None:
                self._conn.execute(
                    "UPDATE organizations SET auth_policy = ? WHERE id = ?",
                    (auth_policy, org_id),
                )
            self._audit(
                actor.id,
                "org.saml_updated",
                "organization",
                org_id,
                {"idp_entity_id": entity_id, "enabled": enabled, "auth_policy": auth_policy},
            )
            self._conn.commit()
        cfg = self.get_org_saml_settings(org_id)
        assert cfg is not None
        return {k: v for k, v in cfg.items() if k not in ("sp_private_key",)}

    def login_or_register_federated(
        self,
        *,
        provider: str,
        subject: str,
        email: str | None,
        display_name: str | None,
        organization_id: str | None,
        issuer: str | None,
    ) -> tuple["User", str]:
        email_clean = field_validators.clean_email(email) if email else None
        with self._lock:
            if organization_id is None:
                row = self._conn.execute(
                    """
                    SELECT user_id FROM user_federated_identities
                    WHERE organization_id IS NULL
                      AND provider = ?
                      AND issuer IS NULL
                      AND subject = ?
                    """,
                    (provider, subject),
                ).fetchone()
            else:
                row = self._conn.execute(
                    """
                    SELECT user_id FROM user_federated_identities
                    WHERE organization_id = ?
                      AND provider = ?
                      AND issuer = ?
                      AND subject = ?
                    """,
                    (organization_id, provider, issuer, subject),
                ).fetchone()
            if row:
                user = self.get_user_by_id(row["user_id"])
                if user is None or user.deactivated_at:
                    raise AdminError(403, "forbidden", "账号已停用")
                token = self._issue_token(user.id)
                self._audit(user.id, "auth.login", "user", user.id, {"provider": provider})
                self._conn.commit()
                return user, token

            user: Any | None = None
            if email_clean:
                existing = self._active_by_email(email_clean)
                if existing is not None:
                    user = _user_from_row_mixin(existing)

            if user is None:
                if not email_clean:
                    raise AdminError(422, "email_required", "IdP 未返回邮箱，无法创建账号")
                if self._setting("open_registration") != "true":
                    first = self._conn.execute("SELECT COUNT(*) AS n FROM users").fetchone()["n"] == 0
                    if not first:
                        raise AdminError(403, "registration_closed", "注册已关闭")
                label = field_validators.clean_name(
                    display_name or email_clean.split("@")[0], "显示名"
                )
                user = self._insert_user_federated(email_clean, label)

            fed_id = str(uuid.uuid4())
            self._conn.execute(
                """
                INSERT INTO user_federated_identities(
                    id, organization_id, provider, issuer, subject, user_id, created_at
                ) VALUES (?, ?, ?, ?, ?, ?, ?)
                """,
                (fed_id, organization_id, provider, issuer, subject, user.id, _now()),
            )
            if organization_id:
                self._conn.execute(
                    """
                    INSERT OR IGNORE INTO org_members(organization_id, user_id, role, joined_at)
                    VALUES (?, ?, 'member', ?)
                    """,
                    (organization_id, user.id, _now()),
                )
            token = self._issue_token(user.id)
            self._audit(user.id, "auth.login", "user", user.id, {"provider": provider, "jit": True})
            self._conn.commit()
        return user, token

    def create_magic_link(self, email: str, *, organization_id: str | None = None) -> str:
        email = field_validators.clean_email(email)
        token = new_token()
        expires = (datetime.now(timezone.utc) + timedelta(minutes=15)).isoformat()
        with self._lock:
            self._conn.execute(
                """
                INSERT INTO magic_link_tokens(token_hash, email, organization_id, expires_at)
                VALUES (?, ?, ?, ?)
                """,
                (hash_token(token), email, organization_id, expires),
            )
            self._conn.commit()
        return token

    def _user_for_magic_link_email(self, email: str) -> "User":
        existing = self._active_by_email(email)
        if existing is not None:
            return _user_from_row_mixin(existing)
        if self._setting("open_registration") != "true":
            raise AdminError(403, "registration_closed", "注册已关闭")
        return self._insert_user_federated(email, email.split("@")[0])

    def consume_magic_link(self, token: str) -> tuple["User", str]:
        th = hash_token(token)
        now = _now()
        with self._lock:
            row = self._conn.execute(
                """
                SELECT email, organization_id, expires_at, consumed_at
                FROM magic_link_tokens WHERE token_hash = ?
                """,
                (th,),
            ).fetchone()
            if row is None:
                raise AdminError(401, "invalid_token", "链接无效或已过期")
            if row["expires_at"] < now:
                raise AdminError(401, "invalid_token", "链接无效或已过期")

            if row["consumed_at"]:
                consumed_at = row["consumed_at"]
                try:
                    consumed_dt = datetime.fromisoformat(consumed_at.replace("Z", "+00:00"))
                    now_dt = datetime.fromisoformat(now.replace("Z", "+00:00"))
                    if (now_dt - consumed_dt).total_seconds() <= 120:
                        user = self._user_for_magic_link_email(row["email"])
                        session = self._issue_token(user.id)
                        self._conn.commit()
                        return user, session
                except ValueError:
                    pass
                raise AdminError(401, "invalid_token", "链接无效或已过期")

            claimed = self._conn.execute(
                """
                UPDATE magic_link_tokens SET consumed_at = ?
                WHERE token_hash = ? AND consumed_at IS NULL AND expires_at >= ?
                """,
                (now, th, now),
            )
            if claimed.rowcount == 0:
                row = self._conn.execute(
                    """
                    SELECT email, organization_id, expires_at, consumed_at
                    FROM magic_link_tokens WHERE token_hash = ?
                    """,
                    (th,),
                ).fetchone()
                if row and row["consumed_at"]:
                    try:
                        consumed_dt = datetime.fromisoformat(
                            row["consumed_at"].replace("Z", "+00:00")
                        )
                        now_dt = datetime.fromisoformat(now.replace("Z", "+00:00"))
                        if (now_dt - consumed_dt).total_seconds() <= 120:
                            user = self._user_for_magic_link_email(row["email"])
                            session = self._issue_token(user.id)
                            self._conn.commit()
                            return user, session
                    except ValueError:
                        pass
                raise AdminError(401, "invalid_token", "链接无效或已过期")

            email = row["email"]
            user = self._user_for_magic_link_email(email)
            org_id = row["organization_id"]
            if org_id:
                self._conn.execute(
                    """
                    INSERT OR IGNORE INTO org_members(organization_id, user_id, role, joined_at)
                    VALUES (?, ?, 'member', ?)
                    """,
                    (org_id, user.id, _now()),
                )
            session = self._issue_token(user.id)
            self._audit(user.id, "auth.login", "user", user.id, {"provider": "magic_link"})
            self._conn.commit()
        return user, session

    def _insert_user_federated(self, email: str, display_name: str) -> "User":
        random_pw = secrets_token()
        user_id = str(uuid.uuid4())
        created_at = _now()
        self._conn.execute(
            """
            INSERT INTO users(id, email, display_name, password_hash, is_admin, created_at)
            VALUES (?, ?, ?, ?, 0, ?)
            """,
            (user_id, email, display_name, hash_password(random_pw), created_at),
        )
        from basis.platform.admin.store import User

        return User(user_id, email, display_name, False, None, created_at)


def _org_from_row(row: Any) -> Organization:
    return Organization(
        id=row["id"],
        name=row["name"],
        slug=row["slug"],
        auth_policy=row["auth_policy"],
        created_at=row["created_at"],
    )


def _user_from_row_mixin(row: Any) -> "User":
    from basis.platform.admin.store import User

    return User(
        id=row["id"],
        email=row["email"],
        display_name=row["display_name"],
        is_admin=bool(row["is_admin"]),
        deactivated_at=row["deactivated_at"],
        created_at=row["created_at"],
    )
