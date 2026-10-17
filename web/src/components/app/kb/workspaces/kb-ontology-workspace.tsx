import { lazy, Suspense } from 'react';
import { KbExplorerConsoleShell } from '@/components/app/kb/explorer-shell/kb-explorer-console-shell.js';
import { Spinner } from '@/components/ui/spinner.js';
import { useI18n } from '@/i18n/context.js';

const OntologyWorkspace = lazy(() =>
  import('@/explorer/workspaces/OntologyWorkspace/index.js').then((module) => ({
    default: module.OntologyWorkspace,
  })),
);

export type OntologyHubPageActions = {
  openLoadOntology: () => void;
};

/** @deprecated Use OntologyHubPageActions */
export type OntologyWorkspacePageActions = OntologyHubPageActions;

export function KbOntologyWorkspace({
  kbId,
  className,
  onPageActionsChange,
}: {
  kbId: string;
  className?: string;
  onPageActionsChange?: (actions: OntologyHubPageActions | null) => void;
}) {
  const { t } = useI18n();
  const loadingLabel = t.kbExplorer.loadingOntology;
  const pageActionsHosted = Boolean(onPageActionsChange);

  return (
    <KbExplorerConsoleShell kbId={kbId} className={className} feature="sparql">
      <div className="flex min-h-0 flex-1 flex-col overflow-hidden">
        <Suspense
          fallback={
            <div className="flex flex-1 items-center justify-center gap-2 text-sm text-muted-foreground">
              <Spinner className="size-4" />
              {loadingLabel}
            </div>
          }
        >
          <OntologyWorkspace
            kbId={kbId}
            pageActionsHosted={pageActionsHosted}
            onPageActionsChange={onPageActionsChange}
          />
        </Suspense>
      </div>
    </KbExplorerConsoleShell>
  );
}
