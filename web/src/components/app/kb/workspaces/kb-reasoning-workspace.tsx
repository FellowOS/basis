import { lazy, Suspense } from 'react';
import { KbExplorerConsoleShell } from '@/components/app/kb/explorer-shell/kb-explorer-console-shell.js';
import { Spinner } from '@/components/ui/spinner.js';
import { useI18n } from '@/i18n/context.js';

const ReasoningWorkspace = lazy(() =>
  import('@/workspaces/ReasoningWorkspace.js').then((module) => ({
    default: module.ReasoningWorkspace,
  })),
);

export function KbReasoningWorkspace({
  kbId,
  className,
}: {
  kbId: string;
  className?: string;
}) {
  const { t } = useI18n();
  const loadingLabel = t.kbExplorer.loadingReasoning;

  return (
    <KbExplorerConsoleShell
      kbId={kbId}
      className={className}
      feature="sparql"
      capabilityOk={(caps) => caps.reasoning}
    >
      <Suspense
        fallback={
          <div className="flex flex-1 items-center justify-center gap-2 text-sm text-muted-foreground">
            <Spinner className="size-4" />
            {loadingLabel}
          </div>
        }
      >
        <ReasoningWorkspace kbId={kbId} />
      </Suspense>
    </KbExplorerConsoleShell>
  );
}
