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
import { OntologyKbProvider } from '@/explorer/workspaces/OntologyWorkspace/ontologyKb.js';

const VocabularyWorkspace = lazy(() =>
  import('@/explorer/workspaces/VocabularyWorkspace/VocabularyWorkspace.js').then((module) => ({
    default: module.VocabularyWorkspace,
  })),
);

const AlignmentsTab = lazy(() =>
  import('@/explorer/workspaces/OntologyWorkspace/AlignmentsTab.js').then((module) => ({
    default: module.AlignmentsTab,
  })),
);

const hubQueryClient = new QueryClient({
  defaultOptions: {
    queries: { retry: 1, refetchOnWindowFocus: false },
  },
});

type ManageTab = 'vocabulary' | 'alignments';

export function KbVocabularyHubWorkspace({
  kbId,
  className,
}: {
  kbId: string;
  className?: string;
}) {
  const { locale } = useI18n();
  const { caps, loading: capsLoading } = useKbCapabilities();
  const config = useMemo(() => buildKbExplorerHttpConfig(kbId), [kbId]);
  const [tab, setTab] = useState<ManageTab>('vocabulary');

  if (!capsLoading && caps && !caps.vocabulary) {
    return <KbExplorerUnavailable kbId={kbId} feature="vocabulary" />;
  }

  const tabs = useMemo(
    () => [
      {
        id: 'vocabulary' as const,
        label: locale === 'zh' ? 'SKOS 词表' : 'Vocabulary',
      },
      {
        id: 'alignments' as const,
        label: locale === 'zh' ? '本体对齐' : 'Alignments',
      },
    ],
    [locale],
  );

  return (
    <div
      className={cn(
        'kb-explorer-console kb-vocabulary-hub relative flex min-h-0 w-full flex-1 flex-col overflow-hidden bg-background text-foreground',
        className,
      )}
      data-kb-id={kbId}
    >
      <QueryClientProvider client={hubQueryClient}>
        <ExplorerHostProvider config={config}>
          <OntologyKbProvider kbId={kbId}>
          <KbExplorerZoneTabs
            variant="console"
            tabs={tabs}
            activeId={tab}
            onChange={(id) => setTab(id as ManageTab)}
          />
          <Suspense
            fallback={
              <div className="flex flex-1 items-center justify-center gap-2 text-sm text-muted-foreground">
                <Spinner className="size-4" />
                {locale === 'zh' ? '加载词表工作台…' : 'Loading vocabulary hub…'}
              </div>
            }
          >
            <div className="flex min-h-0 flex-1 flex-col overflow-hidden">
              {tab === 'vocabulary' ? <VocabularyWorkspace kbId={kbId} /> : <AlignmentsTab />}
            </div>
          </Suspense>
          </OntologyKbProvider>
        </ExplorerHostProvider>
      </QueryClientProvider>
    </div>
  );
}
