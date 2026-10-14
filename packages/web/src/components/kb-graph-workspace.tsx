import { lazy, Suspense, useMemo, useState } from 'react';
import { Link } from 'react-router-dom';
import { QueryClient, QueryClientProvider } from '@tanstack/react-query';
import { ExplorerHostProvider } from '@/explorer/host/explorerHttp.js';
import { buildKbExplorerHttpConfig } from '@/lib/kb-explorer-host.js';
import { KbGraphRebuildButton } from '@/components/kb-graph-rebuild-button.js';
import { KbImportExportDialog } from '@/components/kb-import-export-dialog.js';
import { useKbCapabilities } from '@/lib/kb-capabilities.js';
import { KbExplorerUnavailable } from '@/components/kb-explorer-unavailable.js';
import { Button } from '@/components/ui/button.js';
import { Spinner } from '@/components/ui/spinner.js';
import { useI18n } from '@/i18n/context.js';
import { kbPath } from '@/lib/nav-config.js';
import '@/explorer/ui/primitives.css';

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
}: {
  kbId: string;
  focusNodeId?: string | null;
}) {
  const { locale } = useI18n();
  const { caps, loading: capsLoading } = useKbCapabilities();
  const config = useMemo(() => buildKbExplorerHttpConfig(kbId), [kbId]);
  const zh = locale === 'zh';
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
              <>
                <KbGraphRebuildButton
                  kbId={kbId}
                  onRebuilt={() => setReloadToken((token) => token + 1)}
                />
                <Button type="button" variant="outline" size="sm" asChild>
                  <Link to={`${kbPath(kbId, 'settings')}?tab=graph`}>
                    {zh ? '投影设置' : 'Projection'}
                  </Link>
                </Button>
              </>
            ) : null}
            {canImportExport ? (
              <>
                <Button
                  type="button"
                  variant="outline"
                  size="sm"
                  onClick={() => openImportExport('import')}
                >
                  {zh ? '导入' : 'Import'}
                </Button>
                <Button
                  type="button"
                  variant="outline"
                  size="sm"
                  onClick={() => openImportExport('export')}
                >
                  {zh ? '导出' : 'Export'}
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
                  {zh ? '加载图谱…' : 'Loading graph…'}
                </div>
              }
            >
              <GraphWorkspace
                kbId={kbId}
                externalFocusNodeId={focusNodeId ?? undefined}
                externalFocusToken={focusToken}
                graphDataActions={graphDataActions}
                graphWriteEnabled={!capsLoading && (caps?.graph_write ?? false)}
                decisionsEnabled={!capsLoading && (caps?.decisions ?? false)}
                externalReloadToken={reloadToken}
              />
            </Suspense>
          </div>
        </ExplorerHostProvider>
      </QueryClientProvider>
    </div>
  );
}
