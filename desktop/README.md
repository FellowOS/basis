# Basis Desktop (ADR 0004)

开发：仓库根目录或本目录 `npm run dev`（API + Vite :3001 + Electron）。

打包对齐 Fellow `@fellow/desktop`：`build:desktop` → `stage:api` → `verify:release-resources` → `electron-builder`。

## 日常

```bash
cd desktop && npm install && npm run dev
```

不要在 `web/` 单独跑 `dev:desktop` 指望出现 Electron——那只是 Vite。

已安装的 Basis 与 `npm run dev` **不要同时开**：两者共用 `~/.basis/basis.db`，第二个 API 可能起不来。开发时用 dev；测安装包前先退出 dev。

应用图标：`npm run icons` 用与 sidebar `AppLogo` 相同的 `thinking-orbs` 预设（`working`、20px、浅色主题、静态帧）渲染到 `build/icon.*`；打包脚本会自动跑。

## 打包（macOS）

```bash
cd desktop && npm install
npm run dist:mac:unsigned   # .dmg + .zip（未签名；默认内嵌 Python sidecar）
# 等价于 Fellow 的 dist:mac:unsigned
```

## 打包（Windows）

在 **Windows** 上执行（`stage:api` 内嵌的 Python venv 与当前 OS/架构绑定，不能在 mac 上打出可运行的 Win sidecar）：

```bash
cd desktop && npm install
npm run dist:win:unsigned   # NSIS 安装包 + portable（未签名）
```

产物示例：`release/Basis-0.1.0-win32-x64.exe`、`release/Basis-0.1.0-win32-x64.exe`（portable 同名规则见 electron-builder 输出）。

发布默认 **`stage:api` 会 bundle** `.api-stage/sidecar`（运行时不需要 git checkout / `uv`）。仅本机快速试打小包：

```bash
node scripts/stage-api.mjs --uv-monorepo
```

Web 静态资源来自 `dist/web`（`web` 的 `build:desktop`），不再复制到 `desktop/pack/`。

打包后可选验证：

```bash
npm run smoke:api
```

单测：`npm run test`（`static-server`、release 资源校验、sidebar orb 渲染）。

Web Desktop 产品 e2e（CI `e2e-desktop`）：在 `web/` 下  
`BASIS_E2E_DESKTOP=1 npx playwright test e2e/desktop-product.spec.ts`

## Profile

`profiles/profile.desktop.yaml` — API `server.port: 0`；数据 `~/.basis`；桌面 `auth.enabled: false`。

**Not yet:** 签名 / notarize、Authenticode、Linux AppImage/deb、跨机 Python sidecar 矩阵 CI。
