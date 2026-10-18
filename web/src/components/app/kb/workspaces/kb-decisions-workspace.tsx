import { lazy, Suspense, useCallback } from 'react';
import { useSearchParams } from 'react-router-dom';
import { mergeKbDecisionParam } from '@/lib/reviewUrlState.js';
import { KbGovernanceExplorerShell } from '@/components/app/kb/explorer-shell/kb-governance-explorer-shell.js';
import { KbExplorerUnavailable } from '@/components/app/kb/explorer-shell/kb-explorer-unavailable.js';
import { Spinner } from '@/components/ui/spinner.js';
import { useKbCapabilities } from '@/lib/kb-capabilities.js';
import { useI18n } from '@/i18n/context.js';

const DecisionWorkspace = lazy(() =>
  import('@/explorer/workspaces/DecisionWorkspace/DecisionWorkspace.js').then((module) => ({
    default: module.DecisionWorkspace,
  })),
);

export function KbDecisionsWorkspace({
  kbId,
  className,
}: {
  kbId: string;
  className?: string;
}) {
  const { t } = useI18n();
  const [searchParams, setSearchParams] = useSearchParams();
  const { caps, loading: capsLoading } = useKbCapabilities();
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
    return <KbExplorerUnavailable kbId={kbId} feature="review" />;
  }

  const loadingLabel = t.kbExplorer.loadingDecisions;

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
        <DecisionWorkspace
          kbId={kbId}
          initialFilter={decisionsQuery}
          selectDecisionId={decisionsFocusId || undefined}
          onSelectedDecisionChange={onSelectedDecisionChange}
        />
      </Suspense>
    </KbGovernanceExplorerShell>
  );
}
