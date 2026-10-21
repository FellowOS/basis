import { lazy, Suspense } from 'react';
import { useNavigate } from 'react-router-dom';
import { KbExplorerConsoleShell } from '@/components/app/kb/explorer-shell/kb-explorer-console-shell.js';
import { OntologyKbProvider } from '@/workspaces/OntologyWorkspace/ontologyKb.js';
import { Spinner } from '@/components/ui/spinner.js';
import { useI18n } from '@/i18n/context.js';
import { kbPath } from '@/lib/nav-config.js';
import { cn } from '@/lib/utils.js';
import { wsPage } from '@/lib/ui-classes/console-ws.js';

const ShaclStudio = lazy(() =>
  import('@/workspaces/OntologyWorkspace/ShaclStudio.js').then((module) => ({
    default: module.ShaclStudio,
  })),
);

export function KbShaclWorkspace({
  kbId,
  className,
}: {
  kbId: string;
  className?: string;
}) {
  const { t } = useI18n();
  const navigate = useNavigate();
  const loadingLabel = t.kbExplorer.loadingShacl;

  const onJumpToGraphNode = (nodeId: string) => {
    navigate(`${kbPath(kbId, 'graph')}?focus=${encodeURIComponent(nodeId)}`);
  };

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
          <div className={cn(wsPage, "min-h-0 flex-1")}>
            <ShaclStudio onJumpToNode={onJumpToGraphNode} />
          </div>
        </Suspense>
      </OntologyKbProvider>
    </KbExplorerConsoleShell>
  );
}
