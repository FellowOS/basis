import { lazy, Suspense, useMemo, useState } from 'react';
import { QueryClient, QueryClientProvider } from '@tanstack/react-query';
import { ExplorerHostProvider } from '@/explorer/host/explorerHttp.js';
import { buildKbExplorerHttpConfig } from '@/lib/kb-explorer-host.js';
import { KbGraphRebuildButton } from '@/components/kb/widgets/kb-graph-rebuild-button.js';
import { KbImportExportDialog } from '@/components/kb/dialogs/kb-import-export-dialog.js';
import { useKbCapabilities } from '@/lib/kb-capabilities.js';
import { KbExplorerUnavailable } from '@/components/kb/shell/kb-explorer-unavailable.js';
import { Button } from '@/components/ui/button.js';
import { PublicIcon } from '@/components/ui/public-icon.js';
import { Spinner } from '@/components/ui/spinner.js';
import { useI18n } from '@/i18n/context.js';
import type { Locale } from '@/i18n/locale.js';
import { GraphExplorerThemeSync } from '@/lib/graph/explorer-theme-sync.js';
const GraphWorkspace = lazy(() =>
  import('@/explorer/workspaces/GraphWorkspace/GraphWorkspace.js').then((module) => ({
    default: module.GraphWorkspace,
  })),
);

const graphQueryClient = new QueryClient({
  defaultOptions: {
    queries: {
      retry: 1,
      refetchOnWindowFocus: false,
    },
  },
});

export function KbGraphWorkspace({
  kbId,
  focusNodeId,
  focusAtInstant,
}: {
  kbId: string;
  focusNodeId?: string | null;
  focusAtInstant?: string | null;
}) {
  const { t, locale } = useI18n();
  const g = t.kbGraphPage;
  const apiLocale = locale as Locale;
  const { caps, loading: capsLoading } = useKbCapabilities();
  const config = useMemo(() => buildKbExplorerHttpConfig(kbId, apiLocale), [apiLocale, kbId]);
  const [importExportOpen, setImportExportOpen] = useState(false);
  const [importExportFocus, setImportExportFocus] = useState<'import' | 'export'>('export');
  const [reloadToken, setReloadToken] = useState(0);

  const focusToken = useMemo(() => {
    if (!focusNodeId) return undefined;
    let hash = 0;
    for (let i = 0; i < focusNodeId.length; i += 1) {
      hash = (hash * 31 + focusNodeId.charCodeAt(i)) | 0;
    }
    return Math.abs(hash) || 1;
  }, [focusNodeId]);

  if (!capsLoading && caps && !caps.graph) {
    return <KbExplorerUnavailable kbId={kbId} feature="graph" />;
  }

  function openImportExport(focus: 'import' | 'export') {
    setImportExportFocus(focus);
    setImportExportOpen(true);
  }

  const canImportExport = !capsLoading && caps?.import_export;
  const canRebuild = !capsLoading && caps?.graph_write;

  const graphDataActions =
    canRebuild || canImportExport
      ? (
          <>
            {canRebuild ? (
              <KbGraphRebuildButton
                kbId={kbId}
                iconOnly
                onRebuilt={() => setReloadToken((token) => token + 1)}
              />
            ) : null}
            {canImportExport ? (
              <>
                <Button
                  type="button"
                  variant="outline"
                  size="icon-sm"
                  aria-label={g.import}
                  title={g.import}
                  onClick={() => openImportExport('import')}
                >
                  <PublicIcon name="upload-01" />
                </Button>
                <Button
                  type="button"
                  variant="outline"
                  size="icon-sm"
                  aria-label={g.export}
                  title={g.export}
                  onClick={() => openImportExport('export')}
                >
                  <PublicIcon name="download-01" />
                </Button>
              </>
            ) : null}
          </>
        )
      : undefined;

  return (
    <div
      className="kb-graph-workspace relative flex min-h-0 w-full flex-1 flex-col overflow-hidden bg-background text-foreground"
      data-kb-id={kbId}
      data-testid="kb-graph-workspace"
    >
      <KbImportExportDialog
        kbId={kbId}
        open={importExportOpen}
        onOpenChange={setImportExportOpen}
        focus={importExportFocus}
      />

      <QueryClientProvider client={graphQueryClient}>
        <ExplorerHostProvider config={config}>
          <div className="flex h-full min-h-0 flex-1 flex-col">
            <Suspense
              fallback={
                <div className="flex flex-1 items-center justify-center gap-2 text-sm text-muted-foreground">
                  <Spinner className="size-4" />
                  {t.kbExplorer.loadingGraph}
                </div>
              }
            >
              <GraphExplorerThemeSync>
              <GraphWorkspace
                key={kbId}
                kbId={kbId}
                externalFocusNodeId={focusNodeId ?? undefined}
                externalFocusToken={focusToken}
                externalTemporalAt={focusAtInstant ?? undefined}
                graphDataActions={graphDataActions}
                graphWriteEnabled={!capsLoading && (caps?.graph_write ?? false)}
                decisionsEnabled={!capsLoading && (caps?.decisions ?? false)}
                externalReloadToken={reloadToken}
                apiErrorLocale={apiLocale}
              />
              </GraphExplorerThemeSync>
            </Suspense>
          </div>
        </ExplorerHostProvider>
      </QueryClientProvider>
    </div>
  );
}
