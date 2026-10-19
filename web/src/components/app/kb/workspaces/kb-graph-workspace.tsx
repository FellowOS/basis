import { lazy, Suspense, useCallback, useEffect, useMemo, useRef, useState } from 'react';
import { Link, useSearchParams } from 'react-router-dom';
import { QueryClient, QueryClientProvider } from '@tanstack/react-query';
import { ExplorerHostProvider } from '@/explorer/host/explorerHttp.js';
import { buildKbExplorerHttpConfig } from '@/lib/kb-explorer-host.js';
import { KbGraphDiffPreviewBar } from '@/components/app/kb/widgets/kb-graph-diff-preview-bar.js';
import { KbGraphRebuildButton } from '@/components/app/kb/widgets/kb-graph-rebuild-button.js';
import { graphDiffOverlayFromResponse, emptyGraphDiffOverlay } from '@/lib/graph-diff-overlay.js';
import {
  applyGraphDiffMergePick,
  emptyGraphDiffMergePick,
  graphDiffMergePickReady,
  isGraphDiffMergeCandidate,
  type GraphDiffMergePick,
  type GraphDiffMergePickSlot,
} from '@/lib/graph-diff-merge-pick.js';
import type { KbGraphDiffPreviewParams } from '@/lib/graphUrlState.js';
import { mergeKbGraphDiffFocusParam } from '@/lib/graphUrlState.js';
import { useKbGraphDiff } from '@/lib/use-kb-graph-diff.js';
import { kbOpenApiPOST } from '@/lib/openapi-client.js';
import { formatUserFacingApiError } from '@/lib/api-error-message.js';
import { toast } from 'sonner';
import {
  clearGraphStagingDraft,
  readGraphStagingDraft,
  writeGraphStagingDraft,
} from '@/lib/graph-staging-draft.js';
import { KbImportExportDialog } from '@/components/app/kb/dialogs/kb-import-export-dialog.js';
import { useKbCapabilities } from '@/lib/kb-capabilities.js';
import { KbExplorerUnavailable } from '@/components/app/kb/explorer-shell/kb-explorer-unavailable.js';
import { Button } from '@/components/ui/button.js';
import { SIDEBAR_ICON_BUTTON_CLASS, SidebarIcon } from '@/components/app/shared/shell/sidebar-icon.js';
import { Spinner } from '@/components/ui/spinner.js';
import { useI18n } from '@/i18n/context.js';
import type { Locale } from '@/i18n/locale.js';
import { GraphExplorerThemeSync } from '@/lib/graph/explorer-theme-sync.js';
import { kbGraphDiffPath } from '@/lib/nav-config.js';
import { kbSearchPath } from '@/lib/searchUrlState.js';
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
  openTimelinePanel,
  timelineEntryHref,
  openImportDialog,
  openExportDialog,
  diffPreview,
  onScrubberAtChange,
}: {
  kbId: string;
  focusNodeId?: string | null;
  focusAtInstant?: string | null;
  openTimelinePanel?: boolean;
  /** Deep link to open temporal playback (`?timeline=1`, F-TIM-04). */
  timelineEntryHref?: string;
  /** Deep link `?import=1` / `?export=1` (F-IO / F-DIFF staging path). */
  openImportDialog?: boolean;
  openExportDialog?: boolean;
  diffPreview?: KbGraphDiffPreviewParams;
  onScrubberAtChange?: (atIso: string) => void;
}) {
  const { t, locale } = useI18n();
  const g = t.kbGraphPage;
  const gd = t.kbGraphDiff;
  const apiLocale = locale as Locale;
  const [, setSearchParams] = useSearchParams();
  const { caps, loading: capsLoading } = useKbCapabilities();
  const [mergePick, setMergePick] = useState<GraphDiffMergePick>(() => emptyGraphDiffMergePick());
  const [mergePickSlot, setMergePickSlot] = useState<GraphDiffMergePickSlot>('primary');
  const mergePickSlotRef = useRef(mergePickSlot);
  mergePickSlotRef.current = mergePickSlot;
  const [mergeBusy, setMergeBusy] = useState(false);
  const config = useMemo(() => buildKbExplorerHttpConfig(kbId, apiLocale), [apiLocale, kbId]);
  const [importExportOpen, setImportExportOpen] = useState(false);
  const [importExportFocus, setImportExportFocus] = useState<'import' | 'export'>('export');
  const [reloadToken, setReloadToken] = useState(0);
  const deepLinkDialogOpenedRef = useRef(false);

  useEffect(() => {
    if (deepLinkDialogOpenedRef.current) return;
    if (openImportDialog) {
      deepLinkDialogOpenedRef.current = true;
      setImportExportFocus('import');
      setImportExportOpen(true);
    } else if (openExportDialog) {
      deepLinkDialogOpenedRef.current = true;
      setImportExportFocus('export');
      setImportExportOpen(true);
    }
  }, [openExportDialog, openImportDialog]);

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

  const graphAt = focusAtInstant?.trim() || undefined;
  const graphSearchHref = kbSearchPath(kbId, { scope: 'graph', ...(graphAt ? { at: graphAt } : {}) });

  const diffFrom = diffPreview?.diffFrom;
  const diffTo = diffPreview?.diffTo;
  const {
    diff: graphDiff,
    stagingSessionKey,
    loading: graphDiffLoading,
    error: graphDiffError,
  } = useKbGraphDiff(kbId, diffFrom, diffTo, apiLocale);
  const stagingDraftRestoredRef = useRef(false);
  const diffOverlay = useMemo(() => {
    if (!graphDiff) return emptyGraphDiffOverlay();
    return graphDiffOverlayFromResponse(graphDiff, focusNodeId);
  }, [focusNodeId, graphDiff]);

  const canProposeMerge = Boolean(diffPreview && !capsLoading && caps?.graph_write);

  useEffect(() => {
    if (!diffPreview) {
      setMergePick(emptyGraphDiffMergePick());
      setMergePickSlot('primary');
      stagingDraftRestoredRef.current = false;
    }
  }, [diffPreview?.diffFrom, diffPreview?.diffTo]);

  useEffect(() => {
    stagingDraftRestoredRef.current = false;
  }, [stagingSessionKey]);

  useEffect(() => {
    if (!stagingSessionKey || stagingDraftRestoredRef.current) return;
    const draft = readGraphStagingDraft(stagingSessionKey);
    stagingDraftRestoredRef.current = true;
    if (!draft) return;
    setMergePick({
      primary: draft.primary,
      duplicate: draft.duplicate,
    });
    if (draft.primary && !draft.duplicate) setMergePickSlot('duplicate');
  }, [stagingSessionKey]);

  useEffect(() => {
    if (!stagingSessionKey) return;
    writeGraphStagingDraft(stagingSessionKey, mergePick);
  }, [mergePick, stagingSessionKey]);

  const onDiffPreviewNodeSelect = useCallback(
    (nodeId: string) => {
      if (!diffPreview || !graphDiff) return;
      setSearchParams(
        (prev) => mergeKbGraphDiffFocusParam(prev.toString(), nodeId),
        { replace: true },
      );
      if (!canProposeMerge) return;
      if (!isGraphDiffMergeCandidate(nodeId, graphDiff)) {
        toast.message(g.diffPreviewMergeNotCandidate);
        return;
      }
      setMergePick((pick) => {
        const applied = applyGraphDiffMergePick(pick, nodeId, mergePickSlotRef.current);
        mergePickSlotRef.current = applied.nextSlot;
        setMergePickSlot(applied.nextSlot);
        return applied.pick;
      });
    },
    [canProposeMerge, diffPreview, g.diffPreviewMergeNotCandidate, graphDiff, setSearchParams],
  );

  const submitDiffPreviewMerge = useCallback(async () => {
    if (!graphDiffMergePickReady(mergePick)) return;
    setMergeBusy(true);
    try {
      await kbOpenApiPOST(kbId, 'graph/staging/entity-merge', {
        body: {
          primary_id: mergePick.primary.trim(),
          duplicate_ids: [mergePick.duplicate.trim()],
        },
      });
      toast.success(gd.proposeMergeSuccess);
      if (stagingSessionKey) clearGraphStagingDraft(stagingSessionKey);
      setMergePick(emptyGraphDiffMergePick());
      setMergePickSlot('primary');
    } catch (err) {
      toast.error(formatUserFacingApiError(err, apiLocale));
    } finally {
      setMergeBusy(false);
    }
  }, [apiLocale, gd.proposeMergeSuccess, kbId, mergePick]);

  const graphDataActions = (
    <>
      {timelineEntryHref ? (
        <Button
          type="button"
          variant="outline"
          size="icon-sm"
          className={SIDEBAR_ICON_BUTTON_CLASS}
          aria-label={g.openTimeline}
          title={g.openTimeline}
          asChild
        >
          <Link to={timelineEntryHref} data-testid="kb-graph-open-timeline">
            <SidebarIcon name="clock-backward" />
          </Link>
        </Button>
      ) : null}
      <Button
        type="button"
        variant="outline"
        size="icon-sm"
        className={SIDEBAR_ICON_BUTTON_CLASS}
        aria-label={g.searchGraph}
        title={g.searchGraph}
        asChild
      >
        <Link to={graphSearchHref} data-testid="kb-graph-open-search">
          <SidebarIcon name="search-01" />
        </Link>
      </Button>
      <Button
        type="button"
        variant="outline"
        size="icon-sm"
        className={SIDEBAR_ICON_BUTTON_CLASS}
        aria-label={g.graphDiff}
        title={g.graphDiff}
        asChild
      >
        <Link
          to={kbGraphDiffPath(kbId, graphAt, graphAt)}
          data-testid="kb-graph-open-diff"
        >
          <SidebarIcon name="git-diff" />
        </Link>
      </Button>
      {canRebuild || canImportExport ? (
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
                  className={SIDEBAR_ICON_BUTTON_CLASS}
                  aria-label={g.import}
                  title={g.import}
                  onClick={() => openImportExport('import')}
                >
                  <SidebarIcon name="upload-01" />
                </Button>
                <Button
                  type="button"
                  variant="outline"
                  size="icon-sm"
                  className={SIDEBAR_ICON_BUTTON_CLASS}
                  aria-label={g.export}
                  title={g.export}
                  onClick={() => openImportExport('export')}
                >
                  <SidebarIcon name="download-01" />
                </Button>
              </>
            ) : null}
          </>
        ) : null}
    </>
  );

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
            {diffPreview ? (
              <KbGraphDiffPreviewBar
                kbId={kbId}
                diffFrom={diffPreview.diffFrom}
                diffTo={diffPreview.diffTo}
                diff={graphDiff}
                loading={graphDiffLoading}
                error={graphDiffError}
                canProposeMerge={canProposeMerge}
                mergePick={mergePick}
                mergePickSlot={mergePickSlot}
                onMergePickSlotChange={setMergePickSlot}
                onClearMergePick={() => {
                  setMergePick(emptyGraphDiffMergePick());
                  setMergePickSlot('primary');
                }}
                mergeBusy={mergeBusy}
                onSubmitMerge={() => void submitDiffPreviewMerge()}
              />
            ) : null}
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
                externalOpenTemporalPanel={openTimelinePanel}
                onScrubberAtChange={onScrubberAtChange}
                graphDataActions={graphDataActions}
                graphWriteEnabled={!capsLoading && (caps?.graph_write ?? false)}
                decisionsEnabled={!capsLoading && (caps?.decisions ?? false)}
                externalReloadToken={reloadToken}
                apiErrorLocale={apiLocale}
                externalDiffOverlay={diffPreview ? diffOverlay : null}
                onNodeSelectNotify={diffPreview ? onDiffPreviewNodeSelect : undefined}
              />
              </GraphExplorerThemeSync>
            </Suspense>
          </div>
        </ExplorerHostProvider>
      </QueryClientProvider>
    </div>
  );
}
