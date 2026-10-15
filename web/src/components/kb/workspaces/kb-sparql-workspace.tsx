import { lazy, Suspense } from 'react';
import { KbExplorerConsoleShell } from '@/components/kb/shell/kb-explorer-console-shell.js';
import { Spinner } from '@/components/ui/spinner.js';
import { useI18n } from '@/i18n/context.js';
import type { SparqlPageActions } from '@/explorer/workspaces/SparqlWorkspace/SparqlWorkspace.js';

const SparqlWorkspace = lazy(() =>
  import('@/explorer/workspaces/SparqlWorkspace/SparqlWorkspace.js').then((module) => ({
    default: module.SparqlWorkspace,
  })),
);

export type { SparqlPageActions };

export type KbSparqlPageActions = SparqlPageActions;

export function KbSparqlWorkspace({
  kbId,
  className,
  onPageActionsChange,
}: {
  kbId: string;
  className?: string;
  onPageActionsChange?: (actions: SparqlPageActions | null) => void;
}) {
  const { locale } = useI18n();
  const loadingLabel = locale === 'zh' ? '加载 SPARQL 工作台…' : 'Loading SPARQL workspace…';
  const pageActionsHosted = Boolean(onPageActionsChange);

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
        <SparqlWorkspace
          kbId={kbId}
          pageActionsHosted={pageActionsHosted}
          onPageActionsChange={onPageActionsChange}
        />
      </Suspense>
    </KbExplorerConsoleShell>
  );
}
