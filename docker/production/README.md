# Basis 生产式 Docker 部署

单镜像 **`basis`**：容器内同时跑 **Basis API**（`uv run basis`，内网 `:8090`）与 **Hono web**（`web/server/prod.ts`，对外 `:8080`）。Hono 提供 SPA、`/console/*` BFF，并把 **`/api`**（含 WebSocket）反代到本机 API。数据在 **PostgreSQL** + 卷上的 `BASIS_DATA_DIR`。

```
浏览器 → :8080 (Hono @basis/web，同容器)
           ├─ /              → SPA (dist/web)
           ├─ /console/*     → 控制台 BFF
           └─ /api/*         → 127.0.0.1:8090 (Basis FastAPI)
```

## 启动

```bash
cd docker/production
cp .env.example .env
# 编辑 POSTGRES_PASSWORD

docker compose -f compose.yml up -d --build
```

打开 `http://localhost:8080`（或 `.env` 里的 `BASIS_HTTP_PORT`）。首个注册用户为系统管理员。

仅构建镜像（不启动 compose）：

```bash
docker build -f docker/production/Dockerfile -t basis:local .
```

## CI 发布（GHCR + GitHub Release）

与 **桌面版** 分开：容器用 **`v*`** tag，桌面用 **`desktop-v*`**（见 [`desktop/README.md`](../../desktop/README.md)）。

推送 **`v*`** 时 [`.github/workflows/release-docker.yml`](../../.github/workflows/release-docker.yml) 流程：

1. **`image`**（无需审批）：构建并推送到 GHCR，标签为 **`v0.1.0`**、`0.1.0`、`0.1`（**不含 `latest`**）
2. **本地验证**：`docker pull ghcr.io/<owner>/basis:v0.1.0`，用 compose 或自有环境跑通
3. **`github-release`**（**`release` environment** 审批，Settings → Environments）：把该 tag **提升为 `latest`**，并创建 **Draft** Release **Basis v0.1.0 (Docker)**
4. 在 GitHub **Releases** 核对后点 **Publish release** 对外公布（会标记为 Latest）

若同一 git tag 曾发过**正式** Release，重打 tag 后 CI 会 **改回 Draft**（见 workflow 里 `gh release edit --draft`）。也可手动：`gh release edit v0.1.0 --draft`。

```bash
git tag v0.1.0
git push origin v0.1.0
```

验证用显式版本 tag（审批前 **`latest` 不会指向本次构建**）：

```bash
docker pull ghcr.io/coldbuffer/basis:v0.1.0
```

正式发布并跟 `latest` 后：

```bash
docker pull ghcr.io/coldbuffer/basis:latest
```

仓库需开启 Actions 的 **packages: write**（默认 `GITHUB_TOKEN` 即可）。首次拉取私有包需在 GHCR 授权。

## 登录 / OAuth 设置

在 **系统 → 设置 → 登录** 中，推荐 **同域**：

| 字段 | 示例 |
|------|------|
| API 公网 URL | `http://localhost:8080` |
| Web 应用 Origin | `http://localhost:8080` |

对外域名部署时两者都填 `https://app.example.com`。OAuth 回调列表会变为 `https://app.example.com/api/auth/...`，与 IdP 登记一致。

不要单独把容器内的 8090 映射到公网；用户只访问 **8080**，由 Hono 反代 API。

## TLS

本 compose 仅 HTTP。生产请在 Caddy/Traefik/云 LB 前终止 HTTPS。

## 数据

- PostgreSQL 卷：`basis_postgres_data`
- 应用数据（blob、图 JSON 等）：`basis_app_data` → 容器内 `/data`

备份见根目录 [README.md](../../README.md#operations)（Operations 一节）。

## 与本地开发的区别

| | 本地 dev | 本 Docker 栈 |
|---|----------|----------------|
| 前端 | Hono + Vite :5173 | Hono 静态 + BFF :8080 |
| API | :8090 直连 | 同容器内 :8090（不对外暴露） |
| 浏览器同源 | 5173 + Hono `/api` 反代 | 8080 + Hono `/api` 反代 |

本地 OIDC IdP（可选 Logto）见 [../logto/README.md](../logto/README.md)。
