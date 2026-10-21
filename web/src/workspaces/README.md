# KB workspace UI (vendored from semantica Explorer)

Copied from upstream semantica Knowledge Explorer and **evolved in-tree** (Basis product fork). Screen implementations live under `web/src/workspaces/`; shared HTTP/graph runtime lives in `web/src/ws/`. **Not** a separate npm package (progress M5-02 `excluded`).

Basis mounts `ExplorerHostProvider` with `apiRoot: /api/v1/kbs/{id}` (`@/ws/explorerHttp`, `lib/kb-explorer-host.ts`). No standalone Explorer `App.tsx`; routes lazy-load via `components/app/kb/workspaces/kb-*-workspace.tsx` (see `web/README.md`).

## Layout (Basis vs upstream)

| Upstream `explorer/src/…` | Basis |
| --- | --- |
| `host/explorerHttp.tsx` | `web/src/ws/explorerHttp.tsx` |
| `lib/explorer-api-error.ts` | `web/src/ws/explorer-api-error.ts` |
| `store/*` | `web/src/ws/graphStore.ts`, `registryStore.ts`, `edgePairKeys.*` |
| `ui/primitives.tsx` | `web/src/ws/primitives.tsx` |
| `workspaces/…` | `web/src/workspaces/…` |

Imports from a workspace file typically use `../../ws/explorerHttp`, `../../ws/graphStore`, etc.

## Upstream sync

Cherry-pick from `../semantica` `explorer/src/workspaces/…` into `web/src/workspaces/…`. Remap `host/`, `lib/`, `store/`, `ui/` to `web/src/ws/` per the table above.

```bash
git -C ../semantica show <sha>:explorer/src/workspaces/GraphWorkspace/SomeFile.tsx \
  > web/src/workspaces/GraphWorkspace/SomeFile.tsx
```

Re-run `cd web && npm run typecheck` (and graph e2e when touching GraphWorkspace). **Basis-owned seams:** `ws/explorerHttp.tsx`, `@/lib/kb-explorer-host`, `basis-graph-theme-sync`, `components/app/kb/workspaces/*` shells.
