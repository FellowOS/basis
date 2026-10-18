# Basis 生产式 Docker 部署

单入口：**Hono web 服务**（`web/server/prod.ts`）提供 SPA 静态资源、控制台 `/console/*`（如 Chat LLM 代理），并把 **`/api`**（含 WebSocket upgrade）反代到 **Basis API**；数据在 **PostgreSQL** + 卷上的 `BASIS_DATA_DIR`（blob、图投影等）。

```
浏览器 → :8080 (Hono @basis/web)
           ├─ /              → SPA (dist/web)
           ├─ /console/*     → 控制台 BFF（同进程）
           └─ /api/*         → api:8090 (Basis FastAPI)
```

## 启动

```bash
cd docker/production
cp .env.example .env
# 编辑 POSTGRES_PASSWORD

docker compose -f compose.yml up -d --build
```

打开 `http://localhost:8080`（或 `.env` 里的 `BASIS_HTTP_PORT`）。首个注册用户为系统管理员。

## 登录 / OAuth 设置

在 **系统 → 设置 → 登录** 中，推荐 **同域**：

| 字段 | 示例 |
|------|------|
| API 公网 URL | `http://localhost:8080` |
| Web 应用 Origin | `http://localhost:8080` |

对外域名部署时两者都填 `https://app.example.com`。OAuth 回调列表会变为 `https://app.example.com/api/auth/...`，与 IdP 登记一致。

不要在容器里单独暴露 8090 给公网；用户只访问 web 端口，由 Hono 反代访问 API。

## TLS

本 compose 仅 HTTP。生产请在 Nginx 前加 Caddy/Traefik/云 LB 终止 HTTPS，或自行挂载证书并改 `nginx.conf` 监听 443。

## 数据

- PostgreSQL 卷：`basis_postgres_data`
- 应用数据（blob、图 JSON 等）：`basis_app_data` → 容器内 `/data`

备份见根目录 [README.md](../../README.md#operations)（Operations 一节）。

## 与本地开发的区别

| | 本地 dev | 本 Docker 栈 |
|---|----------|----------------|
| 前端 | Hono + Vite :5173 | Hono 静态 + BFF :8080 |
| API | :8090 直连 | 仅内网 `api:8090` |
| 浏览器同源 | 5173 + Hono `/api` 反代 | 8080 + Hono `/api` 反代 |

Authentik 等 IdP 本地栈见 [../authentik/README.md](../authentik/README.md)。
