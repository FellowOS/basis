# Explorer graph UI (vendored source)

Copied from upstream Semantica Knowledge Explorer. Lives under `packages/web/src/explorer` as normal Sema web source — not a separate package or Vite alias.

Re-sync from upstream (preserve Sema edits in `host/explorerHttp.tsx` and graph load/WS hooks):

```bash
rsync -a --delete ../../semantica/explorer/src/ packages/web/src/explorer/
# Re-apply Sema host patches if rsync overwrote them.
```
