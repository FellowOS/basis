import { lazy, Suspense, useMemo, useState } from 'react';
import { QueryClient, QueryClientProvider } from '@tanstack/react-query';
import { ExplorerHostProvider } from '@/explorer/host/explorerHttp.js';
import { buildKbExplorerHttpConfig } from '@/lib/kb-explorer-host.js';
import { useKbCapabilities } from '@/lib/kb-capabilities.js';
import { KbExplorerUnavailable } from '@/components/kb-explorer-unavailable.js';
import { KbExplorerZoneTabs } from '@/components/kb-explorer-zone-tabs.js';
import { Spinner } from '@/components/ui/spinner.js';
import { useI18n } from '@/i18n/context.js';
import { cn } from '@/lib/utils.js';
import '@/explorer/ui/primitives.css';

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

type AnalyzeTab = 'sparql' | 'reasoning';

export function KbOntologyWorkspace({
  kbId,
  className,
}: {
  kbId: string;
  className?: string;
}) {
  const { locale } = useI18n();
  const { caps, loading: capsLoading } = useKbCapabilities();
  const config = useMemo(() => buildKbExplorerHttpConfig(kbId), [kbId]);

  if (!capsLoading && caps && !caps.sparql && !caps.reasoning) {
    return <KbExplorerUnavailable kbId={kbId} feature="sparql" />;
  }
  const [tab, setTab] = useState<AnalyzeTab>('sparql');

  const tabs = useMemo(
    () => [
      { id: 'sparql' as const, label: 'SPARQL' },
      { id: 'reasoning' as const, label: locale === 'zh' ? '推理' : 'Reasoning' },
    ],
    [locale],
  );

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
            onChange={(id) => setTab(id as AnalyzeTab)}
          />
          <Suspense
            fallback={
              <div className="flex flex-1 items-center justify-center gap-2 text-sm text-muted-foreground">
                <Spinner className="size-4" />
                {locale === 'zh' ? '加载分析工作台…' : 'Loading analysis workspace…'}
              </div>
            }
          >
            <div className="flex min-h-0 flex-1 flex-col overflow-hidden">
              {tab === 'sparql' ? <SparqlWorkspace kbId={kbId} /> : <ReasoningWorkspace kbId={kbId} />}
            </div>
          </Suspense>
        </ExplorerHostProvider>
      </QueryClientProvider>
    </div>
  );
}
