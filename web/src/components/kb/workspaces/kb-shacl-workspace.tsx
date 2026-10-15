import { lazy, Suspense } from 'react';
import { useNavigate } from 'react-router-dom';
import { KbExplorerConsoleShell } from '@/components/kb/shell/kb-explorer-console-shell.js';
import { OntologyKbProvider } from '@/explorer/workspaces/OntologyWorkspace/ontologyKb.js';
import { Spinner } from '@/components/ui/spinner.js';
import { useI18n } from '@/i18n/context.js';
import { kbPath } from '@/lib/nav-config.js';

const ShaclStudio = lazy(() =>
  import('@/explorer/workspaces/OntologyWorkspace/ShaclStudio.js').then((module) => ({
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
  const { locale } = useI18n();
  const navigate = useNavigate();
  const loadingLabel = locale === 'zh' ? '加载 SHACL 工作台…' : 'Loading SHACL studio…';

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
          <div className="ws-page flex min-h-0 flex-1 flex-col overflow-hidden">
            <ShaclStudio onJumpToNode={onJumpToGraphNode} />
          </div>
        </Suspense>
      </OntologyKbProvider>
    </KbExplorerConsoleShell>
  );
}
