# 摄入连接器（KB 数据源）

连接器向知识库的**文档 + 处理流水线**推送或拉取**文本**。控制台：**知识库 → 资料（Sources）** → **摄入来源**；API：`/api/kbs/{kb_id}/sources`。

深链（如 `sync_failed` 告警）：`/kbs/{kb_id}/sources?connectors=1&ingestSource={source_id}` 会打开连接器对话框并高亮对应来源。

## 类型

| 种类 | 方向 | 鉴权 |
| --- | --- | --- |
| `webhook` | 外部系统 POST JSON | 每个数据源独立的 ingest token |
| `http_poll` | Sema 定时 GET URL | 管理用会话 / KB API token；URL 为公网可访问 |
| `git` | Sema GET GitHub raw 文件 | 同 http_poll；MVP 仅公开 GitHub 仓库 |

## Webhook

1. 创建数据源（`kind: webhook`），保存一次性返回的 `ingest_token`。
2. `POST /api/kbs/{kb_id}/sources/{source_id}/webhook`，请求头：`Authorization: Bearer <ingest_token>`。

Body：`text`（必填）、`title`、`external_key`、`auto_process`（默认 true）。

## HTTP 轮询与 Git

- **手动同步：** `POST /api/kbs/{kb_id}/sources/{source_id}/sync`
- **同步记录：** `GET /api/kbs/{kb_id}/sources/{source_id}/sync-history`（`sync_events`，新到旧）
- **定时：** 在 `config` 中设置 `poll_interval_minutes`，并启用服务端 tick：

```bash
SEMA_HTTP_POLL_TICK_SECONDS=60
```

可选 `config`（UI 或 API）：

- `title` — 每次同步的文档标题
- `external_key_prefix` — 自动生成 `doc_id` 的前缀（`prefix-随机`）

Git `config`：`repo_url`（GitHub HTTPS）、`branch`、`paths[]`。

## Ingest token 与 KB 访问 token

| Token | 位置 | 用途 |
| --- | --- | --- |
| **Ingest token** | 连接器对话框（Webhook） | 仅该源的 `.../webhook` |
| **KB MCP token** | 对话 → 连接 | KB 范围 API / MCP |

平台级用户 API token 已移除；请使用 KB 级 token。

## 同步记录与告警

`config.sync_events` 保留最近运行记录；失败会生成 KB **告警**（`sync_failed`），可在顶栏铃铛查看。

## 限制（MVP）

**产品范围：** 仅 `webhook`、`http_poll`、GitHub raw `git` 三种——**暂不增加新连接器类型**，除非产品重新立项。

| 暂不支持 | 说明 |
| --- | --- |
| 完整 `git clone` / 私有 Git | `git` 种类仅拉取 **公开 GitHub raw** 路径 |
| 通用 SaaS OAuth | 请用 `webhook` 或 `http_poll` 对接 |
| S3 预签名 / 新连接器族 | 延后；可用 webhook 或轮询 URL |
| 独立同步任务表 | 历史为 `config.sync_events` 尾部 + `GET .../sync-history` |

英文版：[ingest-connectors.md](./ingest-connectors.md)
