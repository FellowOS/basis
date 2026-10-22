<h1 align="center">Basis — 让智能体读懂真实业务</h1>

<div align="center">

**本体驱动的企业业务语义层。**

[![CI](https://github.com/FellowOS/basis/actions/workflows/ci.yml/badge.svg)](https://github.com/FellowOS/basis/actions/workflows/ci.yml)
[![License](https://img.shields.io/badge/License-Apache%202.0-blue.svg)](LICENSE)
[![Python](https://img.shields.io/badge/python-3.10--3.13-blue.svg)](pyproject.toml)
[![Node](https://img.shields.io/badge/node-%3E%3D22-green.svg)](web/package.json)

[English](./README.md) · **简体中文**

</div>

将文档、数据库与 SaaS 对齐为**实体、类型与可治理事实**——源系统之上的共享语义层。可在桌面、自托管或云端运行，通过 **OpenAPI v1** 与 **MCP** 对外集成。状态变更须经审核，而非静默 API 调用。

Basis 是基于 [Semantica](https://github.com/semantica-agi/semantica) Python SDK 构建的开源技术栈。**业务语义**——映射、本体、规则与 SHACL——落在**规范证据账本**之上；图与搜索为**可重建投影**。

> **状态：** 仍在积极开发，接口可能变动；生产环境请固定发布版本。

<p align="center">
  <img src="assets/graph.png" alt="Basis 图谱工作区 — 力导向图、本体导航、时间轴回放" width="900" style="border-radius: 12px;" />
</p>
<p align="center"><sub>Basis 工作台中的图谱工作区。</sub></p>

## 目录

- [能力概览](#能力概览)
- [为什么选择 Basis](#为什么选择-basis)
- [快速开始](#快速开始)
  - [环境](#环境)
  - [1. 克隆并启动 API](#1-克隆并启动-api)
  - [2. 启动 Web](#2-启动-web)
  - [3. 冒烟验证](#3-冒烟验证)
- [配置（常用）](#配置常用)
- [智能体集成（MCP）](#智能体集成mcp)
- [Semantica 依赖](#semantica-依赖)
- [开发](#开发)
- [部署方式](#部署方式)
  - [桌面客户端](#桌面客户端)
  - [自托管](#自托管)
  - [托管云（SaaS）](#托管云saas)
- [社区](#社区)
- [许可证](#许可证)

## 能力概览

- **业务语义** — 实体、类型化事实、映射与本体；语义单元不是「又一坨切片」。
- **证据账本** — 陈述、溯源；图与向量为可重建投影。
- **工作区** — 文档入库、切片检索（词法 + 向量）、处理任务、审核队列。
- **图谱与本体** — Explorer 风格图工作区、词表、SHACL、SPARQL、Ontology Hub 工作流。
- **连接器（BOCP）** — 内置 provider（如 postgres、mysql、github、slack）；入向同步与受控写回。
- **智能体接口** — 工作区级 **OpenAPI v1** 与 **MCP**（`search_chunks`、`find_entities`、连接器工具、审核操作等）。
- **平台** — 用户、组织 SSO（可选 OIDC/SAML）、工作区角色、API 令牌、审计。

## 为什么选择 Basis

| | 典型「RAG + 裸工具」 | **Basis** |
| --- | --- | --- |
| **读取路径** | 未校验切片 / 临时 SQL | 账本与实体；图与搜索由账本重建 |
| **写入路径** | 无治理的 API 调用 | 审核闸口（`remember`、连接器写回、冲突处理） |
| **业务语义** | 提示词标签 | 共享实体与类型、映射、本体、规则、SHACL、SPARQL |
| **连接** | 各系统手写胶水 | BOCP manifest、OpenAPI v1、MCP |
| **运维** | 多组件拼凑 | API + Web；开发 SQLite，生产 PostgreSQL |

## 快速开始

### 环境

- **Python** 3.10–3.13、[uv](https://docs.astral.sh/uv/)
- **Node.js** ≥ 22、npm

**Semantica** 在 `uv sync` 时从 **PyPI** 安装（版本见 `uv.lock`）。

### 1. 克隆并启动 API

```bash
git clone https://github.com/FellowOS/basis.git
cd basis
cp .env.example .env
uv sync --extra dev
uv run basis
```

默认 `http://127.0.0.1:8090`。

### 2. 启动 Web

```bash
cp web/.env.example web/.env
cd web && npm install && npm run dev
```

浏览器打开 `http://127.0.0.1:5173`，**首个注册用户**为平台管理员。

产品文档 **`http://127.0.0.1:5173/docs`** · 接口探索 **`http://127.0.0.1:8090/swagger`** · 在线规范 **`http://127.0.0.1:8090/openapi/v1.json`**。

### 3. 冒烟验证

1. 创建工作区  
2. **Sources** 粘贴或上传短文，等待处理完成  
3. 打开该工作区的 **Graph** 或 **Search**

以上属于**自托管**开发路径。**桌面客户端**与**托管云**见 [部署方式](#部署方式)。

## 配置（常用）

| 变量 | 默认 | 说明 |
| --- | --- | --- |
| `BASIS_HOST` / `BASIS_PORT` | `127.0.0.1` / `8090` | API 监听 |
| `BASIS_DATA_DIR` | `./data` | SQLite、blob、图 JSON |
| `BASIS_DATABASE_URL` | 空则 SQLite | 生产建议 PostgreSQL |
| `BASIS_API_URL` | `http://127.0.0.1:8090` | Web 代理（`web/.env`） |

详见 [.env.example](.env.example)。

**PostgreSQL：** `docker compose -f compose.postgres.yml up -d`，  
`BASIS_DATABASE_URL=postgresql://basis:basis@127.0.0.1:5432/basis`（宿主机端口 **5432**）。

**备份：** `./scripts/backup_basis_data.sh`（SQLite）或 `./scripts/backup_basis_postgres.sh`（Postgres）。

## 智能体集成（MCP）

在工作区设置中创建 **工作区 API 令牌**（设置 → 令牌）。MCP 端点：

`POST /api/v1/workspaces/{workspace_id}/mcp`，请求头 `Authorization: Bearer <token>`。

示例 `tools/call`（先执行 `tools/list`）：

```bash
curl -sS "http://127.0.0.1:8090/api/v1/workspaces/YOUR_WORKSPACE_ID/mcp" \
  -H "Authorization: Bearer YOUR_WORKSPACE_TOKEN" \
  -H "Content-Type: application/json" \
  -d '{"jsonrpc":"2.0","id":1,"method":"tools/call","params":{"name":"describe_workspace","arguments":{}}}'
```

工具名与 HTTP 路径共用同一操作目录；API 运行时可查看 **`/openapi/v1/workspaces.json`**。

## Semantica 依赖

`semantica` 从 **PyPI** 解析（见 `uv.lock`）。`uv sync` 会安装 Basis 运行时 extras（文档解析、向量、SHACL、兼容 OpenAI 的 LLM 等）。可选分组：`dev`、`heavy`、`explorer`、`saml` — 见 [pyproject.toml](pyproject.toml)。

请勿为 `semantica` 配置本地 `[tool.uv.sources]`（未提交的 `uv.toml` 仍会优先于默认源 — 保持未设置以使用 PyPI）。

处理任务使用 ML NER 时可安装：

```bash
uv run python -m spacy download en_core_web_sm
uv run python -m spacy download zh_core_web_sm   # 中文可选
```

控制台中的对话与嵌入仅在启用 LLM 相关能力时需要配置服务商 API 密钥。

## 开发

```bash
uv run pytest -q
uv run lint-imports --config importlinter.ini
cd web && npm run typecheck && npm test
cd web && CI=1 npm run test:e2e   # 可选；Playwright + API
```

贡献者包结构：`basis/interface`、`application`、`domain`、`infra` — 见 [AGENTS.md](AGENTS.md)。

## 部署方式

同一套产品栈（API + 工作台）。选择**运行位置**——各模式下 **OpenAPI v1** 与 **MCP** 契约一致。

### 桌面客户端

**本机 Electron 应用**：内嵌 API + 工作台，数据目录 `~/.basis`；桌面配置可**免登录**，适合个人单机使用。

- **开发：** `cd desktop && npm install && npm run dev`，打包与 macOS/Windows 说明见 [desktop/README.md](desktop/README.md)。
- **配置：** `BASIS_DEPLOYMENT_PROFILE=desktop`（见 `profiles/profile.desktop.yaml`）。

勿与已安装的桌面版同时跑开发 API——二者共用 `~/.basis/basis.db`。

### 自托管

由**你方运维**（内网、专有云或隔离环境均可）：平台账号、组织 SSO、工作区与备份策略自控。

- **本地试用：** [快速开始](#快速开始)（`uv run basis` + `npm run dev`，SQLite）。
- **生产：** PostgreSQL（`compose.postgres.yml`）、配置 `BASIS_DATABASE_URL`、反向代理 TLS、固定发布版本 — 见 [配置（常用）](#配置常用)。

### 托管云（SaaS）

**FellowOS 托管的多租户服务**：注册、运维与升级由我方负责；智能体仍通过工作区 **HTTP/MCP** 与令牌集成。

托管服务逐步开放；如需访问或试点，请提交 [GitHub Issue](https://github.com/FellowOS/basis/issues) 并说明使用场景。

## 社区

- **缺陷与功能请求：** [GitHub Issues](https://github.com/FellowOS/basis/issues)
- **安全漏洞：** [SECURITY.md](SECURITY.md)（请勿公开提交 issue）
- **贡献：** [CONTRIBUTING.md](CONTRIBUTING.md) · [CODE_OF_CONDUCT.md](CODE_OF_CONDUCT.md)

## 许可证

[Apache License 2.0](LICENSE).
