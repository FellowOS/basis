# Explorer graph UI (vendored source)

Copied from upstream semantica Knowledge Explorer and **evolved in-tree** (Basis product fork). Lives under `web/src/explorer` as normal Basis web source — **not** a separate npm package; that is intentional (progress M5-02 `excluded`).

Basis product uses **KB-only** HTTP: mount `ExplorerHostProvider` with `apiRoot: /api/v1/kbs/{id}` (see `lib/kb-explorer-host.ts`, `lib/kb-api-path.ts`). There is no standalone Explorer `App.tsx` entry; workspaces load from `components/app/kb/workspaces/kb-*-workspace.tsx` (see `web/README.md` for the page → shell → explorer layering). Lineage panel: `components/app/kb/widgets/kb-lineage-panel.tsx`, route `/kbs/:id/lineage`.

**Theme** — Explorer does not ship a separate Basis palette. Console chrome: `web/src/lib/ui-classes/` + global rules in `web/src/styles.css`. Graph canvas/HUD colors: `syncBasisGraphTheme()` in `lib/graph/basis-graph-theme-sync.ts` reads the same CSS variables as the rest of the app (`graphTheme.ts` holds layout/LOD only).

## Layout (Basis fork)

| Upstream `explorer/src/…` | Basis `web/src/explorer/…` |
| --- | --- |
| `host/explorerHttp.tsx` | `explorerHttp.tsx` |
| `lib/explorer-api-error.ts` | `explorer-api-error.ts` |
| `store/graphStore.ts`, `registryStore.ts`, `edgePairKeys.*` | same filenames at explorer root |
| `ui/primitives.tsx` | `primitives.tsx` |
| `workspaces/…` | `workspaces/…` (unchanged) |

`workspaces/*` import shared modules via `../../explorerHttp`, `../../graphStore`, etc.

## Upstream sync (semantica Explorer)

**Default:** selective **cherry-pick** (or per-commit / per-file port) from `../semantica` — not full-tree overwrite. Basis diverges on purpose; only take upstream fixes/features you need.

1. In semantica, note the commit SHA and paths under `explorer/src/…`.
2. Port into `web/src/explorer/…` using the layout table above when upstream paths use `host/`, `lib/`, `store/`, or `ui/`.
3. Re-run `cd web && npm run typecheck` and graph E2E if you touched GraphWorkspace.
4. Record the upstream SHA in your PR / commit message (`explorer: port semantica@<sha> …`).

**Cherry-pick across repos** (semantica cloned beside basis):

```bash
# Manual file port from a given upstream revision (workspaces example):
git -C ../semantica show <sha>:explorer/src/workspaces/GraphWorkspace/SomeFile.tsx \
  > web/src/explorer/workspaces/GraphWorkspace/SomeFile.tsx
```

**Do not routinely** `rsync --delete` the whole tree — it wipes Basis-only edits. Full rsync is only for a deliberate rebuild; then re-apply patches in `explorerHttp.tsx`, graph load/WS hooks, and theme sync.

**Basis-owned seams** (avoid overwriting when porting): `explorerHttp.tsx`, imports that point at `@/lib/kb-explorer-host`, `explorer-theme-sync`, console shell wrappers under `components/app/kb/workspaces/`.
