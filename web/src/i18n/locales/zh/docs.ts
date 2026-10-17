export const docs = {
  sidebarAria: '开发者文档',
  groups: {
    start: '开始使用',
    integrate: '接入',
    reference: '参考',
    ops: '运维',
  },
  pages: {
    overview: {
      navTitle: '概述',
      title: 'Basis 开发者文档',
      description: '可私有化部署的知识平台：证据账本、图谱与检索投影、OpenAPI v1 HTTP，以及面向智能体的 MCP。',
      sections: [
        {
          heading: '可依赖的能力',
          paragraphs: [
            'Basis 提供 `/api/v1/*` 版本化 REST、按库路由 `/api/v1/kbs/{kb_id}/*`，以及在 `/openapi/v1.json` 发布的 OpenAPI。每个知识库可开启 HTTP MCP。',
          ],
          bullets: [
            '平台 API — 用户、知识库、模型、审计、设置',
            '知识库 API — 摄入、账本、检索、图谱、本体、问答',
            'MCP — 与 OpenAPI 对齐的工具面',
          ],
        },
        {
          heading: '建议阅读顺序',
          paragraphs: ['本地跑通后，先理解核心概念再对接生产环境。'],
          bullets: [
            '快速开始 — 启动 API 与 Web 控制台',
            '核心概念 — 账本与投影',
            'REST API — 路径、鉴权与面',
            'API 参考 — OpenAPI 交互文档',
          ],
        },
      ],
    },
    quickstart: {
      navTitle: '快速开始',
      title: '快速开始',
      description: '几条命令在本地运行 API 与 Web 控制台。',
      sections: [
        {
          heading: '环境',
          paragraphs: ['Python 3.10+（uv）、Node.js 22+（Web）。'],
        },
        {
          heading: '本地运行',
          paragraphs: [
            '仓库根目录：复制 `.env.example`，执行 `uv sync --extra dev && uv run basis`（API 8090）。在 `web/`：复制 `.env.example`，`npm install && npm run dev`（控制台 5173）。',
            '注册第一个用户即成为平台管理员。',
          ],
        },
        {
          heading: '验证',
          paragraphs: ['打开控制台创建知识库并上传资料；需要精确请求结构时使用交互式 API 参考。'],
        },
      ],
      links: [{ label: '打开 API 参考（Swagger UI）', href: '/swagger' }],
    },
    concepts: {
      navTitle: '核心概念',
      title: '核心概念',
      description: 'Basis 如何建模知识，以便集成行为一致。',
      sections: [
        {
          heading: '证据账本为权威',
          paragraphs: ['事实与溯源在账本中；图谱、检索索引与导出是可重建的投影。'],
        },
        {
          heading: '语义层',
          paragraphs: [
            '本体、SHACL、SPARQL、映射与规则定义含义。操作变更账本；图谱与检索通过投影任务追上。',
          ],
        },
        {
          heading: '对外面',
          paragraphs: [
            '服务端操作在 OpenAPI v1 与 MCP 中统一定义；Web 通过生成类型调用同一契约，而非另一套未文档化的 HTTP。',
          ],
        },
      ],
    },
    'rest-api': {
      navTitle: 'REST API',
      title: 'REST API（OpenAPI v1）',
      description: '版本化 HTTP 入口，以及如何选择平台面与知识库面。',
      sections: [
        {
          heading: '基址与版本',
          paragraphs: ['规范路由均在 `/api/v1` 下。未版本化的 `/api/*` 为遗留路径，默认关闭（HTTP 410）。'],
        },
        {
          heading: 'OpenAPI 文档',
          paragraphs: ['三份 spec 对应同一实现：'],
          bullets: [
            '`/openapi/v1.json` — 完整面',
            '`/openapi/v1/platform.json` — 平台管理',
            '`/openapi/v1/kb.json` — 单库操作',
          ],
        },
        {
          heading: '会话与令牌',
          paragraphs: ['浏览器控制台使用登录会话；自动化使用平台或单库访问令牌 — 见「鉴权与访问」。'],
        },
      ],
      links: [
        { label: '交互式参考', href: '/swagger' },
        { label: '下载 OpenAPI JSON', href: '/openapi/v1.json', external: true },
      ],
    },
    auth: {
      navTitle: '鉴权与访问',
      title: '鉴权与访问',
      description: '用户、会话、API 令牌与知识库范围凭证。',
      sections: [
        {
          heading: '控制台用户',
          paragraphs: ['通过 `/api/v1/auth/*` 注册登录；会话使用 Cookie，必要时 SPA 使用 Bearer 调用 API。'],
        },
        {
          heading: '访问令牌',
          paragraphs: ['在控制台创建令牌供脚本与智能体使用；知识库令牌将 MCP 与 KB OpenAPI 限定在单个库。'],
        },
        {
          heading: '角色',
          paragraphs: ['平台管理员管理用户与设置；知识库成员按角色（查看、编辑等）在各 KB 路由上鉴权。'],
        },
      ],
    },
    mcp: {
      navTitle: 'MCP',
      title: '面向智能体的 MCP',
      description: '通过 HTTP 将知识库暴露给 Cursor 等 MCP 客户端。',
      sections: [
        {
          heading: '与 OpenAPI 对齐',
          paragraphs: [
            'MCP 工具映射与 OpenAPI v1 相同的操作。客户端已支持 MCP 时优先用 MCP；通用 HTTP 集成用 REST。',
          ],
        },
        {
          heading: '配置概要',
          paragraphs: ['在知识库设置中创建访问令牌并记录该库的 MCP URL；在 Agent 主机中以 Bearer 配置令牌。'],
        },
      ],
    },
    'api-reference': {
      navTitle: 'API 参考',
      title: 'API 参考',
      description: '机器可读的 OpenAPI v1 与交互式浏览器 — 非手工维护的端点清单。',
      sections: [
        {
          heading: '交互式浏览器',
          paragraphs: [
            'Swagger UI 从当前部署加载 spec。Try it out 从浏览器发请求；先登录可自动附带会话 token。',
          ],
        },
        {
          heading: 'Spec 变体',
          paragraphs: ['在浏览器工具栏切换完整、仅平台、仅知识库三份文档。'],
        },
      ],
      links: [
        { label: '打开 Swagger UI', href: '/swagger' },
        { label: '完整 OpenAPI JSON', href: '/openapi/v1.json', external: true },
        { label: '平台 OpenAPI JSON', href: '/openapi/v1/platform.json', external: true },
        { label: '知识库 OpenAPI JSON', href: '/openapi/v1/kb.json', external: true },
      ],
    },
    deployment: {
      navTitle: '私有化部署',
      title: '私有化部署与配置',
      description: '环境变量与生产部署要点。',
      sections: [
        {
          heading: '常用配置',
          paragraphs: ['生产环境常见项：'],
          bullets: [
            '`BASIS_HOST` / `BASIS_PORT` — API 监听',
            '`BASIS_DATA_DIR` — SQLite、blob、图谱 JSON（默认）',
            '`BASIS_DATABASE_URL` — 生产 PostgreSQL',
            '`VITE_BASIS_API_URL` — 非同源时浏览器 API 基址',
          ],
        },
        {
          heading: '反向代理',
          paragraphs: [
            '托管 Web 静态资源，并将 `/api`、`/openapi` 与 WebSocket 转发到 API。示例见仓库 `docker/production/`。',
          ],
        },
      ],
    },
  },
} as const;
