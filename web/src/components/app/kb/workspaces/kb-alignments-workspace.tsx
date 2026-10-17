import { lazy, Suspense } from 'react';
import { KbExplorerConsoleShell } from '@/components/app/kb/explorer-shell/kb-explorer-console-shell.js';
import { OntologyKbProvider } from '@/explorer/workspaces/OntologyWorkspace/ontologyKb.js';
import { Spinner } from '@/components/ui/spinner.js';
import { useI18n } from '@/i18n/context.js';

const AlignmentsTab = lazy(() =>
  import('@/explorer/workspaces/OntologyWorkspace/AlignmentsTab.js').then((module) => ({
    default: module.AlignmentsTab,
  })),
);

export function KbAlignmentsWorkspace({
  kbId,
  className,
}: {
  kbId: string;
  className?: string;
}) {
  const { t } = useI18n();
  const loadingLabel = t.kbExplorer.loadingAlignments;

  return (
    <KbExplorerConsoleShell kbId={kbId} className={className} feature="sparql">
      <OntologyKbProvider kbId={kbId}>
        <Suspense
          fallback={
            <div className="flex flex-1 items-center justify-center gap-2 text-sm text-muted-foreground">
              <Spinner className="size-4" />
              {loadingLabel}
            </div>
          }
        >
          <div className="ws-page flex min-h-0 flex-1 flex-col overflow-hidden">
            <AlignmentsTab />
          </div>
        </Suspense>
      </OntologyKbProvider>
    </KbExplorerConsoleShell>
  );
}
