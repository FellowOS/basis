import { lazy, Suspense, useEffect, useRef } from 'react';
import { KbGovernanceExplorerShell } from '@/components/kb/shell/kb-governance-explorer-shell.js';
import { KbExplorerUnavailable } from '@/components/kb/shell/kb-explorer-unavailable.js';
import { Spinner } from '@/components/ui/spinner.js';
import { useKbCapabilities } from '@/lib/kb-capabilities.js';
import { useI18n } from '@/i18n/context.js';

const EntityResolutionTab = lazy(() =>
  import('@/explorer/workspaces/EnrichWorkspace/EntityResolutionTab.js').then((module) => ({
    default: module.EntityResolutionTab,
  })),
);

export type EntityResolutionPageActions = {
  openDedupScan: () => void;
};

export function KbEntityResolutionWorkspace({
  kbId,
  className,
  onPageActionsChange,
}: {
  kbId: string;
  className?: string;
  onPageActionsChange?: (actions: EntityResolutionPageActions | null) => void;
}) {
  const { locale } = useI18n();
  const { caps, loading: capsLoading } = useKbCapabilities();
  const dedupScanRef = useRef<() => void>(() => {});

  useEffect(() => {
    if (!onPageActionsChange) return;
    onPageActionsChange({
      openDedupScan: () => dedupScanRef.current(),
    });
    return () => onPageActionsChange(null);
  }, [onPageActionsChange]);

  if (!capsLoading && caps && !caps.enrichment) {
    return <KbExplorerUnavailable kbId={kbId} feature="review" />;
  }

  const loadingLabel =
    locale === 'zh' ? '加载实体解析…' : 'Loading entity resolution…';

  return (
    <KbGovernanceExplorerShell kbId={kbId} className={className}>
      <Suspense
        fallback={
          <div className="flex flex-1 items-center justify-center gap-2 text-sm text-muted-foreground">
            <Spinner className="size-4" />
            {loadingLabel}
          </div>
        }
      >
        <EntityResolutionTab
          kbId={kbId}
          pageActionsHosted={Boolean(onPageActionsChange)}
          onScanActionReady={(open) => {
            dedupScanRef.current = open;
          }}
        />
      </Suspense>
    </KbGovernanceExplorerShell>
  );
}
