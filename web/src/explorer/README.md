# Explorer graph UI (vendored source)

Copied from upstream semantica Knowledge Explorer and **evolved in-tree** (Basis product fork). Lives under `web/src/explorer` as normal Basis web source — **not** a separate npm package; that is intentional (progress M5-02 `excluded`).

Basis product uses **KB-only** HTTP: mount `ExplorerHostProvider` with `apiRoot: /api/v1/kbs/{id}` (see `lib/kb-explorer-host.ts`, `lib/kb-api-path.ts`). There is no standalone Explorer `App.tsx` entry; workspaces load from `components/app/kb/workspaces/kb-*-workspace.tsx` (see `web/README.md` for the page → shell → explorer layering). Lineage panel: `components/app/kb/widgets/kb-lineage-panel.tsx`, route `/kbs/:id/lineage`.

**Theme** — Explorer does not ship a separate Basis palette. Console chrome: `web/src/lib/ui-classes/` + global rules in `web/src/styles.css`. Graph canvas/HUD colors: `syncBasisGraphTheme()` in `lib/graph/basis-graph-theme-sync.ts` reads the same CSS variables as the rest of the app (`graphTheme.ts` holds layout/LOD only).

## Upstream sync (semantica Explorer)

**Default:** selective **cherry-pick** (or per-commit / per-file port) from `../semantica` — not full-tree overwrite. Basis diverges on purpose; only take upstream fixes/features you need.

1. In semantica, note the commit SHA and paths under `explorer/src/…`.
2. Port into `web/src/explorer/…` (same relative path under `explorer/src` → `web/src/explorer`).
3. Re-run `cd web && npm run typecheck` and graph E2E if you touched GraphWorkspace.
4. Record the upstream SHA in your PR / commit message (`explorer: port semantica@<sha> …`).

**Cherry-pick across repos** (semantica cloned beside basis):

```bash
# Example: apply one upstream commit, then fix path/conflicts in web/src/explorer
git -C ../semantica log -1 --oneline <sha>
git cherry-pick -x <sha>   # only if semantica is a git submodule/remote of basis; otherwise port files manually

# Manual file port from a given upstream revision:
git -C ../semantica show <sha>:explorer/src/workspaces/GraphWorkspace/SomeFile.tsx \
  > web/src/explorer/workspaces/GraphWorkspace/SomeFile.tsx
```

**Do not routinely** `rsync --delete` the whole tree — it wipes Basis-only edits. Full rsync is only for a deliberate rebuild; then re-apply patches in `host/explorerHttp.tsx`, graph load/WS hooks, and theme sync.

**Basis-owned seams** (avoid overwriting when porting): `host/explorerHttp.tsx`, `host/*` Basis hooks, imports that point at `@/lib/kb-explorer-host`, `explorer-theme-sync`, console shell wrappers under `components/app/kb/workspaces/`.
