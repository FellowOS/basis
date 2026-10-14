import { lazy, Suspense, useMemo } from 'react';
import { Link, useNavigate } from 'react-router-dom';
import { QueryClient, QueryClientProvider } from '@tanstack/react-query';
import { ExplorerHostProvider } from '@/explorer/host/explorerHttp.js';
import { buildKbExplorerHttpConfig } from '@/lib/kb-explorer-host.js';
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogHeader,
  DialogTitle,
} from '@/components/ui/dialog.js';
import { Spinner } from '@/components/ui/spinner.js';
import { useI18n } from '@/i18n/context.js';
import { kbPath } from '@/lib/nav-config.js';
import '@/explorer/ui/primitives.css';

const ImportExportWorkspace = lazy(() =>
  import('@/explorer/workspaces/ImportExportWorkspace/ImportExportWorkspace.js').then((module) => ({
    default: module.ImportExportWorkspace,
  })),
);

const importExportQueryClient = new QueryClient({
  defaultOptions: {
    queries: { retry: 1, refetchOnWindowFocus: false },
  },
});

export function KbImportExportDialog({
  kbId,
  open,
  onOpenChange,
  focus = 'import',
}: {
  kbId: string;
  open: boolean;
  onOpenChange: (open: boolean) => void;
  focus?: 'import' | 'export';
}) {
  const { locale } = useI18n();
  const navigate = useNavigate();
  const config = useMemo(() => buildKbExplorerHttpConfig(kbId), [kbId]);
  const zh = locale === 'zh';
  const isImport = focus === 'import';

  function goToReviewQueue() {
    onOpenChange(false);
    navigate(`${kbPath(kbId, 'review')}?tab=queue`);
  }

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="flex max-h-[min(92vh,48rem)] flex-col gap-0 overflow-hidden p-0 sm:max-w-4xl">
        <DialogHeader className="border-b border-border px-6 py-4 text-left">
          <DialogTitle>
            {isImport
              ? zh
                ? '提交图导入（审核）'
                : 'Submit graph import (review)'
              : zh
                ? '导出图快照'
                : 'Export graph snapshot'}
          </DialogTitle>
          <DialogDescription className="space-y-2">
            {isImport
              ? zh
                ? '上传 JSON/CSV 图数据后进入审核队列，批准前不会更新当前画布。'
                : 'Upload JSON/CSV graph data to the review queue; the canvas does not change until approved.'
              : zh
                ? '下载当前知识库 Explorer 图的 JSON 或 CSV 快照。'
                : 'Download a JSON or CSV snapshot of the current Explorer graph.'}
            {isImport ? (
              <span className="block">
                <Link
                  className="text-primary underline-offset-4 hover:underline"
                  to={`${kbPath(kbId, 'review')}?tab=queue`}
                  onClick={() => onOpenChange(false)}
                >
                  {zh ? '前往审核队列' : 'Open review queue'}
                </Link>
              </span>
            ) : null}
          </DialogDescription>
        </DialogHeader>
        <div className="kb-explorer-console relative min-h-0 flex-1 overflow-y-auto bg-background text-foreground">
          <QueryClientProvider client={importExportQueryClient}>
            <ExplorerHostProvider config={config}>
              <Suspense
                fallback={
                  <div className="flex items-center justify-center gap-2 py-16 text-sm text-muted-foreground">
                    <Spinner className="size-4" />
                    {zh ? '加载中…' : 'Loading…'}
                  </div>
                }
              >
                <ImportExportWorkspace
                  kbId={kbId}
                  focusSection={focus}
                  onImportQueued={goToReviewQueue}
                  importQueuedActionLabel={zh ? '前往审核队列' : 'Open review queue'}
                />
              </Suspense>
            </ExplorerHostProvider>
          </QueryClientProvider>
        </div>
      </DialogContent>
    </Dialog>
  );
}
