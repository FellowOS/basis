import { lazy, Suspense } from 'react';
import { KbExplorerConsoleShell } from '@/components/kb/shell/kb-explorer-console-shell.js';
import { OntologyKbProvider } from '@/explorer/workspaces/OntologyWorkspace/ontologyKb.js';
import { Spinner } from '@/components/ui/spinner.js';
import { useI18n } from '@/i18n/context.js';

const VersionsTab = lazy(() =>
  import('@/explorer/workspaces/OntologyWorkspace/VersionsTab.js').then((module) => ({
    default: module.VersionsTab,
  })),
);

export function KbOntologyVersionsWorkspace({
  kbId,
  className,
}: {
  kbId: string;
  className?: string;
}) {
  const { t } = useI18n();
  const loadingLabel = t.kbExplorer.loadingOntologyVersions;

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
          <VersionsTab />
        </Suspense>
      </OntologyKbProvider>
    </KbExplorerConsoleShell>
  );
}
