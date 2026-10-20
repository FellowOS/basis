# Semantica 基础 SDK 集成计划（线 1）

**状态：** 进行中（Phase 0 完成；Phase 1 已启动）  
**最后更新：** 2026-10-20

本文只描述 **Basis 如何减少对 `semantica.explorer` 包的依赖、以核心 SDK 承载领域能力**。  
**不在本文范围：** 企业 OWL（如 FIBO）导入后 Explorer 画布节点/边数量——沿用 Semantica `load_ontology` 行为，**不作为 Basis 交付项**（2026-10 产品决定）。

相关契约：[explorer-session-registry.md](explorer-session-registry.md)、[explorer.md](explorer.md)（当前集成方式）、[package-layout.md](package-layout.md)、[0001-canonical-knowledge-model.md](0001-canonical-knowledge-model.md)。

---

## 1. 目标与非目标

### 1.1 目标

| ID | 目标 |
| --- | --- |
| G1 | **图与投影**继续以 `semantica.context.ContextGraph` 为内存模型；Basis 保留 `basis.domain.graph.GraphSession` 作为唯一 KB 图入口。 |
| G2 | **新增与演进的后端领域逻辑**默认只依赖 `semantica.context`、`semantica.ingest`、`semantica.ontology`、`semantica.kg` 等核心包，**不新增**对 `semantica.explorer.routes.*` 的 import。 |
| G3 | 将今天经 `invoke_explorer(semantica.explorer.routes…)` 透传的能力，按优先级 **迁到 Basis 域服务 + Basis HTTP 路由**；Explorer 路由逐步变为薄兼容层或删除。 |
| G4 | **依赖可观测：** CI 或脚本可列出 `semantica.explorer` 引用并阻止增长（allowlist 递减）。 |
| G5 | **`semantica[explorer]` 依赖**在终态可降为可选（仅 vendored 前端或过渡期需要时安装）；终态未强制日期，以阶段验收为准。 |

### 1.2 非目标

| ID | 非目标 |
| --- | --- |
| NG1 | 不替换 `web/src/explorer` 整棵 UI 树（仍可按 [explorer.md §前端](explorer.md) cherry-pick）；线 1 重点是 **Python 边界**。 |
| NG2 | 不要求一次性删除所有 Explorer 路由；**绞杀者（strangler）** 按工作区/路由分批。 |
| NG3 | **不**在本计划内追求 OWL 导入图投影「更满」或修改 OntologyIngestor 行为（Semantica 上游或产品外范围）。 |
| NG4 | 不引入第二套并行图存储（例如默认 Jena/Neo4j 与 ContextGraph 双写），除非 ADR 另立。 |

---

## 2. 现状摘要

```text
semantica.context.ContextGraph          ← 基础 SDK（已在用）
        ↑
basis.domain.graph.GraphSession         ← Basis 自有封装（canonical）
        ↑
basis 持久化 / projector / ledger     ← Basis 领域
        ↑
semantica.explorer.session.GraphSession  ← 包装同一 graph，主要为 search_index + 路由约定
        ↑
semantica.explorer.routes.*           ← 大量 invoke_explorer 透传（待缩减）
        ↑
basis/transport/http/routes/v1/kb_*   ← JWT、KB 作用域、审计
```

**Backend 仍直接 import `semantica.explorer` 的主要位置（2026-10）：**

| 区域 | 文件（代表性） |
| --- | --- |
| 本体 Hub | `basis/domain/explorer/ontology_kb_hub.py` |
| 本体 / 词汇表适配 | `basis/transport/http/routes/v1/kb_ontology.py` |
| 图 / 时态 / enrich / 溯源 | `basis/transport/http/routes/v1/kb_explorer.py` |
| Explorer 运行时 | `basis/domain/explorer/registry.py`、`kb_scoped_ontology_state.py` |
| 能力开关 | `basis/infra/capabilities.py` |
| 审核 / E2E | `kb_review.py`、`kb_e2e_helpers.py`、部分 tests |

**已符合线 1 的部分：** 投影重建（`basis/domain/graph/projector.py`）、账本、ingest pipeline、连接器运行时等 **不依赖** Explorer 路由。

---

## 3. 原则

1. **单一图真相：** 任意迁移不得创建与 `GraphSession` 脱钩的第二份可变图；读写经 `graph_for` / 域服务进入同一 `ContextGraph`。
2. **契约稳定：** 对 `web/src/explorer` 暴露的 HTTP 路径与 JSON 形状，迁移期保持 **OpenAPI 兼容**（或版本化 `/v2` + 前端同步，单次 PR 内完成）。
3. **先竖井、后横切：** 按 **工作区/路由域**（ontology、graph read、sparql、vocabulary…）迁移，避免「大 bang」替换 `invoke_explorer`。
4. **不复制 Explorer 全集：** 迁出的 Basis 服务只实现 **Basis 产品实际调用的 operation**（以 `openapi/web-openapi-operation-audit.md` 与 e2e 为准）。
5. **Ontology Hub 导入：** 产品保持 Explorer `load_ontology`；线 1 迁移 registry/路由壳子时 **不改变** 该导入语义。

---

## 4. 阶段与交付物

### Phase 0 — 基线与护栏（P1）

| 项 | 交付 |
| --- | --- |
| P0-1 | 本文档 + `progress.md` 条目（跟踪状态） |
| P0-2 | 脚本：`scripts/audit-semantica-explorer-imports.py`（或扩展现有 audit）——列出 `basis/`、`tests/` 中 `semantica.explorer` import；CI 对 **新增** 引用失败（allowlist 文件提交在 repo） |
| P0-3 | `AGENTS.md` 或 `package-layout.md` 一句：**新 Python 功能禁止新增 `semantica.explorer.routes` 依赖** |

**验收：** allowlist 与当前 grep 一致；CI 绿。

### Phase 1 — 运行时与图读（P1）

| 项 | 交付 |
| --- | --- |
| P1-1 | 文档化 `ExplorerSessionRegistry` 职责：仅 **search index / analytics 适配**；列出可迁到 `ContextGraph` 原生 API 的调用点 |
| P1-2 | 将 **不经过 Explorer 路由** 的图统计/邻域类读路径收拢到 `basis/domain/explorer/graph_read.py`（已部分存在则补缺口清单） |
| P1-3 | 评估 `rebuild_search_index`：保留 Explorer 包装 **或** 在 Basis 内调用 `ContextGraph` 上等价方法（需 spike，不阻塞 P1-2） |

**验收：** `kb_explorer` 中至少一条高频只读路由改为 Basis 域服务实现；行为单测/e2e 不退化。

### Phase 2 — 本体 / 词汇表域（P1）

| 项 | 交付 |
| --- | --- |
| P2-1 | 新建 `basis/domain/ontology/`（扩展现有 `service.py`）：**registry 元数据**持久化策略（Postgres 或图节点 + 侧表 ADR 片段） |
| P2-2 | `ontology_kb_hub` / `kb_ontology`：将 **非 UI 必需** 的 Explorer 调用改为 Basis 服务；保留 OpenAPI operationId 不变 |
| P2-3 | 废弃 `KbOntologyState` 对 `semantica.explorer.routes.ontology._get_registry` 的 patch（终态：registry 在 Basis） |

**验收：** 重启 API 后本体 registry 不丢（若采用持久化）；allowlist 中 ontology 相关 explorer import 减少。

### Phase 3 — SPARQL、enrich、provenance、temporal（P2）

按调用频率与复杂度分批，每批：

- Basis 域服务实现；
- `kb_explorer` 改 wiring；
- 从 allowlist 移除对应 `semantica.explorer.routes.*` import。

**验收：** 各批对应 `tests/test_kb_explorer_routes.py` / e2e 子集通过。

### Phase 4 — 依赖与打包（P2）

| 项 | 交付 |
| --- | --- |
| P4-1 | `pyproject.toml`：拆分 `semantica[explorer]` 为可选 extra（如 `basis[explorer-compat]`），默认开发/CI 仍安装直至 Phase 3 完成 |
| P4-2 | `explorer_available()` 与桌面 profile：无 explorer extra 时优雅降级（capabilities 已有则收紧） |

**验收：** 在仅安装核心 semantica extra 的配置下，核心 KB（文库、ledger、图读、连接器）可启动；Ontology/SPARQL 等按 capabilities 标为不可用。

---

## 5. 成功指标（线 1 专用）

| 指标 | 目标（终态方向） |
| --- | --- |
| `semantica.explorer.routes` import 文件数 | 从 ~8 降至 **0**（tests 除外或 mock） |
| `semantica.explorer.session` import | **0** 或仅测试夹具 |
| 新 PR 引入 explorer.routes | **CI 拒绝** |
| OpenAPI `/kbs/{id}/…` 对外契约 | **无破坏性变更**（或显式版本 bump） |

---

## 6. 风险与缓解

| 风险 | 缓解 |
| --- | --- |
| 与 vendored Explorer 前端响应形状漂移 | 以 OpenAPI snapshot + e2e 为契约；迁移单路由单 PR |
| 搜索/分析行为 subtly 不同 | Phase 1 spike + 对比 `rebuild_search_index` 前后 graph search 结果 |
| 双轨 registry（内存 patch vs Basis DB） | Phase 2 明确单一来源；迁移窗口短 |
---

## 7. 跟踪

| 字段 | 值 |
| --- | --- |
| Progress | [progress.md §3.4](../progress.md) |
| Features | 暂无独立 F-*；若立项可增 `F-ONT-10` / `F-ARCH-01` |
| Owner | TBD |
| 依赖 | — |

---

## 8. 修订记录

| 日期 | 说明 |
| --- | --- |
| 2026-10-20 | 初稿；OWL 导入图投影齐全性不在 Basis 范围 |
