# Explorer graph UI (vendored source)

Copied from upstream Semantica Knowledge Explorer. Lives under `packages/web/src/explorer` as normal Sema web source — not a separate package or Vite alias.

Sema product uses **KB-only** HTTP: mount `ExplorerHostProvider` with `apiRoot: /api/kbs/{id}` (see `lib/kb-explorer-host.ts`). Legacy standalone `/api/graph` paths rewrite under that host; there is no `/api/...` fallback without a KB context.

Re-sync from upstream (preserve Sema edits in `host/explorerHttp.tsx` and graph load/WS hooks):

```bash
rsync -a --delete ../../semantica/explorer/src/ packages/web/src/explorer/
# Re-apply Sema host patches if rsync overwrote them.
```
