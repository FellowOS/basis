# ADR 0004: Desktop 部署（本机 SQLite、免登录）

**Status:** accepted — **Phase A–C** in tree (Electron dev shell); **Phase D** packaging deferred  
**Context:** 同级产品 [Fellow Gateway](https://github.com/fellowos/gateway) 提供 Desktop 形态：Electron 壳、本地 SQLite、固定本机用户、无需注册登录。Basis 默认已是 SQLite 两进程（API + Web），但鉴权与控制台路由始终面向多用户 / SSO 部署。需要一条与 Server 同代码库的 Desktop 路径，且不把「本机信任」误用于公网多租户。

**Related:** [0002-organization-tenant-sso.md](0002-organization-tenant-sso.md)（Server 租户与 SSO）、[data-model.md](data-model.md)（SQLite 主存）、根目录 [README.zh-CN.md](../../README.zh-CN.md#运维)（`BASIS_DATA_DIR` / 备份）

## Decision（目标态）

1. 引入 **部署画像（deployment profile）**：`server`（默认）与 `desktop`。
2. **Desktop profile** 下：
   - 数据目录默认在用户主目录（如 `~/.basis`），数据库为 SQLite（与今天 dev 一致，不引入 Postgres 为默认）。
   - **认证关闭**（`auth.enabled: false` 语义）：无 Bearer 时 API 解析为固定的本机 principal；不开放注册、OAuth、组织 SSO。
   - API **仅监听 loopback**（`127.0.0.1`）；Desktop profile 若配置为非 loopback 则启动失败。
3. Web 通过 **运行时标志** `authRequired`（构建 env + 可选 Electron preload）跳过登录门禁，并在需要时调用 **desktop session bootstrap** 获取长期 token（复用现有 `basis_token` 存储）。
4. **Electron 壳**为可选交付层：负责 spawn API、解析就绪事件、注入 `apiBase`；Python 运行时打包为独立阶段（体积大于 Fellow Node gateway）。

Server profile 行为不变：Bearer / API Token、组织 SSO、多用户管理、可选 PostgreSQL。

## 现状对照

| 维度 | Fellow Desktop | Basis 今天 |
| --- | --- | --- |
| 存储 | `profile.desktop.yaml` → `~/.fellow/data.db` | `BASIS_DATA_DIR` + `basis.db`（默认 `./data`） |
| 进程 | Electron spawn gateway | `basis serve` + `web` |
| 认证 | `auth.enabled: false`，`DEFAULT_USER_ID` | `get_current_user` → 无 token 即 401 |
| 前端 | `VITE_AUTH_REQUIRED=false`，`getAppRuntime().authRequired` | `AuthedApp` 无 user 则回首页 / 登录 |

后端硬门槛在 `basis.transport.http.deps`：`resolve_bearer` 要求 `Authorization: Bearer`。

## 目标架构

```text
┌─────────────────────────────────────────────────────────────┐
│ Desktop Shell（可选 Electron）                               │
│  main: spawn API, 解析 basis.ready, preload → apiBase       │
└──────────────────────────┬──────────────────────────────────┘
                           │
         ┌─────────────────┴─────────────────┐
         ▼                                   ▼
┌─────────────────┐                 ┌─────────────────┐
│ Basis API       │                 │ Basis Web       │
│ profile desktop │◄── HTTP ────────│ authRequired    │
│ auth off →      │                 │ false → /kbs    │
│ local principal │                 └─────────────────┘
└────────┬────────┘
         ▼
   SQLite ~/.basis/basis.db + blobs/ + graphs/
```

Fellow 参考实现（同 monorepo 外）：

- Profile：`gateway/profiles/profile.desktop.yaml`（`auth.enabled: false`，SQLite path）。
- Policy：`gateway/packages/deployment-policy`（`requireAuth()` / `resolveUser()`）。
- 客户端：`client/packages/desktop`（`server-manager` 解析 `gateway.ready`）。

Basis 使用仓库内 **`profiles/profile.desktop.yaml`**（字段与 Fellow `gateway/profiles/profile.desktop.yaml` 对齐：`deployment` / `auth` / `server` / `database` / `storage`），经 `basis serve --profile desktop` 注入 `BASIS_*` 环境变量；**不**嵌入 Fellow gateway 二进制。前端 **`getAppRuntime()`**（`web/src/lib/app-runtime.ts`）对标 Fellow `@fellow/app-runtime`；Electron 解析 **`basis.ready`** 与 **`gateway.ready`**。

## 1. 后端

### 1.1 配置

在 `basis.infra.config.Settings`（或同级模块）增加：

| 变量 | 默认 | Desktop 建议 |
| --- | --- | --- |
| `BASIS_PROFILE` / `--profile` | — | `desktop` 或 YAML 路径 |
| `BASIS_DEPLOYMENT_PROFILE` | `server` | `desktop`（profile 注入） |
| `BASIS_DATA_DIR` | `./data` | `~/.basis`（`storage.root` / `BASIS_HOME`） |
| `BASIS_HOST` | `127.0.0.1` | 必须 loopback |
| `BASIS_PORT` | `8090` | profile 可 `0`（OS 分配端口） |

派生行为（profile = `desktop`）：

- `auth_enabled = False`
- 平台 `password_login` / OAuth / 组织 OIDC 路由禁用或返回 403
- 不使用「开放注册」路径

### 1.2 本机 principal

应用 lifespan（或迁移完成后）调用 `ensure_desktop_principal(store)`：

- 固定 `user_id`（常量，类似 Fellow `DEFAULT_USER_ID`）。
- 若不存在则插入用户（如 `local@basis.local`，`is_admin=true`）。
- 可选：创建默认 KB（避免空库仅见 setup 向导）。

审计与 MCP 调用均带同一 actor id，便于与 Server 多用户模型区分。

### 1.3 鉴权依赖

抽出 `resolve_actor(request, authorization) -> User`：

| Profile | 行为 |
| --- | --- |
| `server` | 现有 `resolve_bearer` |
| `desktop` | 无 `Authorization` → local principal；有 token → 仍校验 session（为日后「桌面连云」预留） |

所有 `Depends(get_current_user)` 改为经 `resolve_actor`（单点修改 `deps.py`）。

**安全：** Desktop 不是匿名公网服务；禁止 `0.0.0.0` + desktop profile 组合。

### 1.4 Bootstrap API（推荐）

`GET` 或 `POST /api/v1/auth/desktop-session`（仅 desktop profile）：

- 返回 `{ user, token }`，供 Web 写入现有 `basis_token`。
- OpenAPI 客户端与 `BasisSessionProvider` 改动最小。

### 1.5 就绪事件

`basis serve` 启动后输出一行结构化日志，供 Electron 解析：

```json
{"event":"basis.ready","host":"127.0.0.1","port":8090,"profile":"desktop"}
```

可选：`BASIS_PORT=0` 由 OS 分配端口（与 Fellow `port: 0` 一致）。

## 2. Web 控制台

### 2.1 运行时

- 构建：`vite build --mode desktop`，`.env.desktop` 中 `VITE_BASIS_AUTH_REQUIRED=false`。
- 运行时：`getBasisRuntime()` — Electron `window.__BASIS_DESKTOP__` 优先，否则 Vite env（对标 Fellow `getAppRuntime()`）。

### 2.2 Session 与路由

- `BasisSessionProvider`：`!authRequired` 时调用 desktop-session 或依赖 API 免 token + `/me` 合成 user。
- `web/src/app.tsx`：将 `ready && !user` 的守卫改为 `authRequired ? 现有逻辑 : 进入 /kbs`。
- 隐藏或禁用：注册 / 登录营销、`/admin/users`、组织 SSO、多租户入口；保留 **模型 / API Key**（对标 Fellow 首次 Setup）。

### 2.3 CORS

Desktop 同源或固定 `apiBase` 时，扩展 `CORSMiddleware` allowlist（如 `file://` 或壳内 static 端口）——实现阶段按 Electron 加载方式定。

## 3. Desktop Shell（新包）

建议路径：`basis/desktop/`（或日后 `fellowos/client` 式独立仓）。

```text
desktop/
  electron/
    main.ts              # 生命周期、窗口
    server-manager.ts    # spawn basis serve，解析 basis.ready
    preload.ts           # __BASIS_DESKTOP__ { apiBase, desktop, authRequired }
  scripts/
    dev.mjs              # API + vite + electron
    stage-api.mjs        # 发布：打包 Python 运行时（重）
```

Main 进程职责：

1. 设置 `BASIS_DEPLOYMENT_PROFILE=desktop`、`BASIS_DATA_DIR`。
2. 子进程：`uv run basis serve`（开发）或打包二进制（发布）。
3. 将 `apiBase` 注入 renderer；生产可复用 `web/server/prod.ts` 代理。

**与 Fellow 差异：** Basis 依赖 Python + semantica（spaCy、向量、本地 embedding 等），安装包体积与打包链是 **独立大项**；可先交付「本机已安装 uv 的开发者 Desktop」，再做 DMG/NSIS。

## 4. Desktop 功能策略

| 能力 | Server | Desktop |
| --- | --- | --- |
| SQLite + sqlite-vec | 默认 dev | 唯一推荐后端 |
| PostgreSQL | 生产 | 隐藏或不支持 |
| 多用户 / 用户管理 | ✓ | ✗（单 principal） |
| Organization / SSO | ADR 0002 | profile 关闭 |
| 平台审计 | ✓ | 保留，actor 固定 |
| API Token（MCP / 集成） | ✓ | ✓ 建议保留 |
| 开放注册 | 配置项 | 强制关闭 |

## 5. 分期交付

| 阶段 | 内容 | 验收 |
| --- | --- | --- |
| **A** | 无 Electron：`BASIS_DEPLOYMENT_PROFILE=desktop` + Web `VITE_BASIS_AUTH_REQUIRED=false` | 免登录建库、ingest、Explorer、MCP |
| **B** | bootstrap API、UI 裁剪、`desktop` Vite mode | 发布物为静态 web + 文档化 env |
| **C** | Electron dev（spawn API + HMR） | 一键 `pnpm dev:desktop` 类体验 |
| **D** | 安装包、签名、Python sidecar | macOS / Windows 安装包 |
| **E**（可选） | 桌面连云 | Server auth 保留；local 切换时忽略残留 cloud session（Fellow 同策略） |

Phase A 环境示例：

```bash
export BASIS_DEPLOYMENT_PROFILE=desktop
export BASIS_DATA_DIR="$HOME/.basis"
export BASIS_HOST=127.0.0.1
uv run basis serve
# web/: VITE_BASIS_AUTH_REQUIRED=false npm run dev
```

## 6. 非目标

- Desktop profile 不作为多租户或内网免密共享服务。
- 不在 Desktop 默认启用 Postgres 或组织级 SSO。
- 第一阶段不要求与 Fellow 共用 Electron 仓库或 npm gateway bundle。

## 7. 实现检查清单（落地时）

- [x] `Settings.deployment_profile` + desktop 约束（loopback、auth off）
- [x] `ensure_desktop_principal` + 可选默认 KB
- [x] `resolve_actor` 替换 `get_current_user` 路径
- [x] `/api/v1/auth/desktop-session` + OpenAPI 描述（待生成快照）
- [x] `basis.ready` 日志行
- [x] Web：`basisAuthRequired`、`fetchSession` desktop bootstrap、`app.tsx` 守卫（`web/.env.desktop`）
- [x] i18n：Desktop 平台设置说明（`platformSettings.desktopSettingsLead`）
- [x] 测试：`tests/test_desktop_profile.py`（无 token `/kbs`、desktop-session、server 401）
- [x] Web UI 裁剪：隐藏用户/审计/组织 SSO；`build:desktop`；`desktop/` Electron `npm run dev`
- [x] Phase D：`desktop/npm run dist:mac:unsigned` — `dist/web` + electron-builder（Fellow `dist:mac` 链；产出 `Basis-*-darwin-{arch}.dmg` + `.zip`）
- [x] Phase D+（portable，Fellow 对齐）：`npm run dist:mac:unsigned` — `stage:api` → `.api-stage/sidecar` + `verify:release-resources` + `electron-builder`
- [x] 快速本地： `dist:mac:dir` — 仅 `release/mac*/Basis.app`（无 dmg）
- [x] Phase D++（Win 链）：`dist:win` / `dist:win:unsigned` — NSIS + portable（须在 Windows 上 `stage:api`）
- [ ] Phase D+++：签名 / notarize、Authenticode、Linux 发布、sidecar 跨平台 CI 矩阵
- [ ] `docs/progress.md` F-* 条目（Desktop `partial`）

## Consequences

- **正面：** 与 Fellow Desktop 产品叙事一致；复用现有 SQLite 账本与 Web/Explorer；Server 代码路径不分叉。
- **负面：** 需维护 profile 矩阵与 UI 裁剪；Python 打包成本高于 Node gateway；错误配置 loopback 需硬性拒绝。
- **迁移：** 现有 `./data` 开发库可通过 `BASIS_DATA_DIR` 指向；Desktop 不自动导入 Server 的 Postgres 数据。
