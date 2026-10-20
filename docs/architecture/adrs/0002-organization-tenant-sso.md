# ADR 0002: Organization as customer tenant (SSO / OIDC)

**Status:** accepted (2026-03-16)  
**Context:** Basis will support per-customer OIDC (enterprise SSO), plus optional GitHub, Google, and magic link. SSO configuration must attach to a stable tenant boundary, not to individual knowledge bases or global env only.

## Decision

**「客户」= `organizations` 表中的一条组织（tenant）。**

- 每个组织可有 **多个 KB**、**多个用户**。
- **企业 OIDC 配置** 绑定在 `organization_id` 上（一组织一套 Issuer + client，后续可扩展多套 IdP）。
- **KB 归属组织**：`knowledge_bases.organization_id`（必填；迁移期为现有 KB 回填默认组织）。
- **用户与组织**：`org_members(org_id, user_id, role)`，与现有 `kb_members` 并存——组织成员可被加入多个 KB，KB 权限仍用 `kb_members.role`。

平台级能力（与组织无关或全局默认）：

- **GitHub / Google**：平台 `settings` 或独立 `platform_oauth` 配置；组织可策略性关闭「社交登录」。
- **Magic link**：按邮箱发送；若邮箱域名命中某组织的 OIDC 且该组织 **强制 SSO**，则拒绝 magic link / 密码登录。
- **密码登录**：保留；组织级 `auth_policy` 可设为 `password_allowed | sso_required | sso_preferred`。

## Rationale

| 方案 | 结论 |
|------|------|
| SSO 绑 `kb_id` | 同一公司多 KB 需重复配置 SSO，员工身份分裂。 |
| 仅环境变量 Issuer | 仅适合单租户部署，不符合「按客户配 OIDC」。 |
| 新建 `organizations` | 与 B2B 习惯一致，和 Fellow 的 instance/租户思路可对齐，扩展计费、域名、审计自然。 |

## Data model (target)

```text
organizations
  id, name, slug (unique), created_at, auth_policy, ...

org_members
  organization_id, user_id, role (owner | admin | member), joined_at
  PRIMARY KEY (organization_id, user_id)

knowledge_bases
  ... existing columns ...
  organization_id NOT NULL → organizations(id)

org_oidc_configs
  organization_id (PK or unique per org for v1)
  issuer, client_id, client_secret_ciphertext, scopes, email_domains (JSON array)
  enabled, created_at, updated_at

user_federated_identities
  organization_id, provider ('oidc' | 'github' | 'google'), issuer, subject
  user_id, created_at
  UNIQUE (organization_id, provider, issuer, subject)
```

**登录路由（实现时）：**

- `GET /api/auth/oidc/{org_slug}/start` — 加载该组织的 OIDC 配置，Authlib 跳转 IdP。
- `GET /api/auth/oidc/callback` — `state` 含 signed `organization_id`，换 token 后 JIT 用户 + 写 `user_federated_identities`，签发现有 Bearer `tokens` 行。

**租户发现（v1）：**

1. URL：`/login?org={slug}` 或 `/o/{slug}/login`
2. 邮箱域名：与 `org_oidc_configs.email_domains` 匹配（可多个组织时最长匹配或显式 slug 优先）

## Migration (sketch)

1. 创建 `organizations`、`org_members`、`org_oidc_configs`、`user_federated_identities`。
2. 为每个现有 KB 创建或挂到一个组织（简单策略：每个 KB 一个同名组织，owner = KB owner；或按 `created_by` 合并到用户默认组织）。
3. `ALTER knowledge_bases ADD organization_id`，回填后 `NOT NULL`。

## Consequences

- 控制台需要 **系统 → 设置 → 组织 SSO**（org owner/admin）；平台 admin 可列出全部组织并运维。
- `AdminStore` / API 权限增加 `org_members` 检查；KB 操作仍检查 `kb_members`。
- 实现 OIDC 前必须先落地组织表与 KB 归属，否则 SSO 配置无处挂载。

## Out of scope (later)

- SAML — see [ADR 0006](0006-org-saml.md)（`org_saml_configs` shipped）
- 一组织多套 OIDC（`org_oidc_configs.id` 多行 + 登录页选择 IdP）
- 与 Fellow Gateway 账号联邦（可选同步，非本 ADR 要求）
