import { lazy, Suspense, useEffect, useRef } from 'react';
import { GovernanceWorkspaceShell } from '@/components/app/shared/workspace/frame/governance-ws-shell.js';
import { WorkspaceUnavailable } from '@/components/app/shared/workspace/frame/ws-unavailable.js';
import { Spinner } from '@/components/ui/spinner.js';
import { useWorkspaceCapabilities } from '@/lib/workspace/capabilities.js';
import { useI18n } from '@/i18n/context.js';

const EntityResolutionScreen = lazy(() =>
  import('@/modules/entity-resolution/pages/screen.js').then((module) => ({
    default: module.EntityResolutionScreen,
  })),
);

export type EntityResolutionPageActions = {
  openDedupScan: () => void;
};

export function EntityResolutionPanel({
  workspaceId,
  className,
  onPageActionsChange,
}: {
  workspaceId: string;
  className?: string;
  onPageActionsChange?: (actions: EntityResolutionPageActions | null) => void;
}) {
  const { t } = useI18n();
  const { caps, loading: capsLoading } = useWorkspaceCapabilities();
  const dedupScanRef = useRef<() => void>(() => {});

  useEffect(() => {
    if (!onPageActionsChange) return;
    onPageActionsChange({
      openDedupScan: () => dedupScanRef.current(),
    });
    return () => onPageActionsChange(null);
  }, [onPageActionsChange]);

  if (!capsLoading && caps && !caps.enrichment) {
    return <WorkspaceUnavailable workspaceId={workspaceId} feature="review" />;
  }

  return (
    <GovernanceWorkspaceShell workspaceId={workspaceId} className={className}>
      <Suspense
        fallback={
          <div className="flex flex-1 items-center justify-center gap-2 text-sm text-muted-foreground">
            <Spinner className="size-4" />
            {t.entity_resolution.page.loading}
          </div>
        }
      >
        <EntityResolutionScreen
          workspaceId={workspaceId}
          pageActionsHosted={Boolean(onPageActionsChange)}
          onScanActionReady={(open) => {
            dedupScanRef.current = open;
          }}
        />
      </Suspense>
    </GovernanceWorkspaceShell>
  );
}
