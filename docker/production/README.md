# Basis 生产式 Docker 部署

单入口：**Nginx** 提供前端静态资源，并把 **`/api`**（含 WebSocket）反代到 **Basis API**；数据在 **PostgreSQL** + 卷上的 `BASIS_DATA_DIR`（blob、图投影等）。

```
浏览器 → :8080 (nginx)
           ├─ /          → SPA (dist/web)
           └─ /api/*     → api:8090 (Basis FastAPI)
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

不要在容器里单独暴露 8090 给公网；用户只访问 Nginx 端口，由反代访问 API。

## TLS

本 compose 仅 HTTP。生产请在 Nginx 前加 Caddy/Traefik/云 LB 终止 HTTPS，或自行挂载证书并改 `nginx.conf` 监听 443。

## 数据

- PostgreSQL 卷：`basis_postgres_data`
- 应用数据（blob、图 JSON 等）：`basis_app_data` → 容器内 `/data`

备份见 [docs/ops/backup-and-restore.md](../../docs/ops/backup-and-restore.md)。

## 与本地开发的区别

| | 本地 dev | 本 Docker 栈 |
|---|----------|----------------|
| 前端 | Vite :5173 | Nginx 静态 |
| API | :8090 直连 | 仅内网 `api:8090` |
| 浏览器同源 | 5173 + `/api` 代理 | 单端口 + `/api` 反代 |

Authentik 等 IdP 本地栈见 [../authentik/README.md](../authentik/README.md)。
