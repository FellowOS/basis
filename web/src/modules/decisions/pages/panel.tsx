import { lazy, Suspense, useCallback } from 'react';
import { useSearchParams } from 'react-router-dom';
import { mergeKbDecisionParam } from '@/modules/review/lib/reviewUrlState.js';
import { GovernanceWorkspaceShell } from '@/components/app/shared/workspace/frame/governance-ws-shell.js';
import { WorkspaceUnavailable } from '@/components/app/shared/workspace/frame/ws-unavailable.js';
import { Spinner } from '@/components/ui/spinner.js';
import { useWorkspaceCapabilities } from '@/lib/workspace/capabilities.js';
import { useI18n } from '@/i18n/context.js';

const DecisionScreen = lazy(() =>
  import('@/modules/decisions/pages/screen.js').then((module) => ({
    default: module.DecisionScreen,
  })),
);

export function DecisionsPanel({
  workspaceId,
  className,
}: {
  workspaceId: string;
  className?: string;
}) {
  const { t } = useI18n();
  const [searchParams, setSearchParams] = useSearchParams();
  const { caps, loading: capsLoading } = useWorkspaceCapabilities();
  const decisionsQuery = searchParams.get('q') ?? '';
  const decisionsFocusId = searchParams.get('decision') ?? '';

  const onSelectedDecisionChange = useCallback(
    (decisionId: string) => {
      const next = mergeKbDecisionParam(searchParams.toString(), decisionId);
      setSearchParams(next, { replace: true });
    },
    [searchParams, setSearchParams],
  );

  if (!capsLoading && caps && !caps.decisions) {
    return <WorkspaceUnavailable workspaceId={workspaceId} feature="review" />;
  }

  return (
    <GovernanceWorkspaceShell workspaceId={workspaceId} className={className}>
      <Suspense
        fallback={
          <div className="flex flex-1 items-center justify-center gap-2 text-sm text-muted-foreground">
            <Spinner className="size-4" />
            {t.decisions.page.loading}
          </div>
        }
      >
        <DecisionScreen
          workspaceId={workspaceId}
          initialFilter={decisionsQuery}
          selectDecisionId={decisionsFocusId || undefined}
          onSelectedDecisionChange={onSelectedDecisionChange}
        />
      </Suspense>
    </GovernanceWorkspaceShell>
  );
}
