# Explorer graph UI (vendored source)

Copied from upstream semantica Knowledge Explorer. Lives under `web/src/explorer` as normal Basis web source — not a separate package or Vite alias.

Basis product uses **KB-only** HTTP: mount `ExplorerHostProvider` with `apiRoot: /api/v1/kbs/{id}` (see `lib/kb-explorer-host.ts`, `lib/kb-api-path.ts`). There is no standalone Explorer `App.tsx` entry; workspaces load from `components/app/kb/workspaces/kb-*-workspace.tsx` (see `web/README.md` for the page → shell → explorer layering). Lineage panel: `components/app/kb/widgets/kb-lineage-panel.tsx`, route `/kbs/:id/lineage`.

**Theme** — Explorer does not ship a separate Basis palette. Console chrome: `web/src/lib/ui-classes/` + global rules in `web/src/styles.css`. Graph canvas/HUD colors: `syncBasisGraphTheme()` in `lib/graph/basis-graph-theme-sync.ts` reads the same CSS variables as the rest of the app (`graphTheme.ts` holds layout/LOD only).

Re-sync from upstream (preserve Basis edits in `host/explorerHttp.tsx` and graph load/WS hooks):

```bash
rsync -a --delete ../semantica/explorer/src/ web/src/explorer/
# Re-apply Basis host patches if rsync overwrote them.
```
