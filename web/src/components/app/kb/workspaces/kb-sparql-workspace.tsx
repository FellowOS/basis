import { lazy, Suspense } from 'react';
import { KbExplorerConsoleShell } from '@/components/app/kb/explorer-shell/kb-explorer-console-shell.js';
import { Spinner } from '@/components/ui/spinner.js';
import { useI18n } from '@/i18n/context.js';

const SparqlWorkspace = lazy(() =>
  import('@/workspaces/SparqlWorkspace/SparqlWorkspace.js').then((module) => ({
    default: module.SparqlWorkspace,
  })),
);

export function KbSparqlWorkspace({
  kbId,
  className,
}: {
  kbId: string;
  className?: string;
}) {
  const { t } = useI18n();
  const loadingLabel = t.kbExplorer.loadingSparql;

  return (
    <KbExplorerConsoleShell
      kbId={kbId}
      className={className}
      feature="sparql"
      capabilityOk={(caps) => caps.sparql}
    >
      <Suspense
        fallback={
          <div className="flex flex-1 items-center justify-center gap-2 text-sm text-muted-foreground">
            <Spinner className="size-4" />
            {loadingLabel}
          </div>
        }
      >
        <SparqlWorkspace kbId={kbId} />
      </Suspense>
    </KbExplorerConsoleShell>
  );
}
