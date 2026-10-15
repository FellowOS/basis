import { lazy, Suspense, useEffect, useMemo, useState } from 'react';
import { useNavigate, useSearchParams } from 'react-router-dom';
import { QueryClient, QueryClientProvider } from '@tanstack/react-query';
import { ExplorerHostProvider } from '@/explorer/host/explorerHttp.js';
import { buildKbExplorerHttpConfig } from '@/lib/kb-explorer-host.js';
import { useKbCapabilities } from '@/lib/kb-capabilities.js';
import { KbExplorerUnavailable } from '@/components/kb-explorer-unavailable.js';
import { KbExplorerZoneTabs } from '@/components/kb-explorer-zone-tabs.js';
import { Spinner } from '@/components/ui/spinner.js';
import { useI18n } from '@/i18n/context.js';
import { kbPath } from '@/lib/nav-config.js';
import { cn } from '@/lib/utils.js';
import '@/explorer/ui/primitives.css';

const OntologyWorkspace = lazy(() =>
  import('@/explorer/workspaces/OntologyWorkspace/index.js').then((module) => ({
    default: module.OntologyWorkspace,
  })),
);

const SparqlWorkspace = lazy(() =>
  import('@/explorer/workspaces/SparqlWorkspace/SparqlWorkspace.js').then((module) => ({
    default: module.SparqlWorkspace,
  })),
);

const ReasoningWorkspace = lazy(() =>
  import('@/explorer/workspaces/ReasoningWorkspace.js').then((module) => ({
    default: module.ReasoningWorkspace,
  })),
);

const ontologyQueryClient = new QueryClient({
  defaultOptions: {
    queries: { retry: 1, refetchOnWindowFocus: false },
  },
});

type OntologyZoneTab = 'hub' | 'sparql' | 'reasoning';

export function KbOntologyWorkspace({
  kbId,
  className,
}: {
  kbId: string;
  className?: string;
}) {
  const { locale } = useI18n();
  const navigate = useNavigate();
  const { caps, loading: capsLoading } = useKbCapabilities();
  const config = useMemo(() => buildKbExplorerHttpConfig(kbId), [kbId]);
  const [searchParams] = useSearchParams();
  const [tab, setTab] = useState<OntologyZoneTab>('hub');

  useEffect(() => {
    const fromUrl = searchParams.get('ontologyTab');
    if (fromUrl === 'hub' || fromUrl === 'sparql' || fromUrl === 'reasoning') {
      setTab(fromUrl);
    }
  }, [searchParams]);

  const explorerReady = caps?.explorer_runtime && caps.graph;

  if (!capsLoading && caps && !explorerReady) {
    return <KbExplorerUnavailable kbId={kbId} feature="sparql" />;
  }

  const tabs = useMemo(
    () => [
      {
        id: 'hub' as const,
        label: locale === 'zh' ? '本体 Hub' : 'Ontology hub',
      },
      { id: 'sparql' as const, label: 'SPARQL' },
      { id: 'reasoning' as const, label: locale === 'zh' ? '推理' : 'Reasoning' },
    ],
    [locale],
  );

  const onJumpToGraphNode = (nodeId: string) => {
    navigate(`${kbPath(kbId, 'graph')}?focus=${encodeURIComponent(nodeId)}`);
  };

  const loadingLabel =
    locale === 'zh' ? '加载本体与分析工作台…' : 'Loading ontology & analysis…';

  return (
    <div
      className={cn(
        'kb-explorer-console kb-ontology-workspace relative flex min-h-0 w-full flex-1 flex-col overflow-hidden bg-background text-foreground',
        className,
      )}
      data-kb-id={kbId}
    >
      <QueryClientProvider client={ontologyQueryClient}>
        <ExplorerHostProvider config={config}>
          <KbExplorerZoneTabs
            variant="console"
            tabs={tabs}
            activeId={tab}
            onChange={(id) => setTab(id as OntologyZoneTab)}
          />
          <Suspense
            fallback={
              <div className="flex flex-1 items-center justify-center gap-2 text-sm text-muted-foreground">
                <Spinner className="size-4" />
                {loadingLabel}
              </div>
            }
          >
            <div className="flex min-h-0 flex-1 flex-col overflow-hidden">
              {tab === 'hub' ? (
                <OntologyWorkspace kbId={kbId} onJumpToGraphNode={onJumpToGraphNode} />
              ) : tab === 'sparql' ? (
                caps?.sparql ? (
                  <SparqlWorkspace kbId={kbId} />
                ) : (
                  <KbExplorerUnavailable kbId={kbId} feature="sparql" />
                )
              ) : caps?.reasoning ? (
                <ReasoningWorkspace kbId={kbId} />
              ) : (
                <KbExplorerUnavailable kbId={kbId} feature="sparql" />
              )}
            </div>
          </Suspense>
        </ExplorerHostProvider>
      </QueryClientProvider>
    </div>
  );
}
