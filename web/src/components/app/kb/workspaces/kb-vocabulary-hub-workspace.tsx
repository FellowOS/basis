import { lazy, Suspense, useMemo } from 'react';
import { QueryClient, QueryClientProvider } from '@tanstack/react-query';
import { ExplorerHostProvider } from '@/explorer/explorerHttp.js';
import { buildKbExplorerHttpConfig } from '@/lib/kb-explorer-host.js';
import { useKbCapabilities } from '@/lib/kb-capabilities.js';
import { KbExplorerUnavailable } from '@/components/app/kb/explorer-shell/kb-explorer-unavailable.js';
import { Spinner } from '@/components/ui/spinner.js';
import { useI18n } from '@/i18n/context.js';
import { cn } from '@/lib/utils.js';
import { govEmbeddedWorkspaceShell } from '@/lib/ui-classes/governance-ui.js';
import { OntologyKbProvider } from '@/explorer/workspaces/OntologyWorkspace/ontologyKb.js';

const VocabularyWorkspace = lazy(() =>
  import('@/explorer/workspaces/VocabularyWorkspace/VocabularyWorkspace.js').then((module) => ({
    default: module.VocabularyWorkspace,
  })),
);

const hubQueryClient = new QueryClient({
  defaultOptions: {
    queries: { retry: 1, refetchOnWindowFocus: false },
  },
});

export function KbVocabularyHubWorkspace({
  kbId,
  className,
}: {
  kbId: string;
  className?: string;
}) {
  const { t, locale } = useI18n();
  const { caps, loading: capsLoading } = useKbCapabilities();
  const config = useMemo(() => buildKbExplorerHttpConfig(kbId, locale), [kbId, locale]);

  if (!capsLoading && caps && !caps.vocabulary) {
    return <KbExplorerUnavailable kbId={kbId} feature="vocabulary" />;
  }

  return (
    <div
      className={cn(
        'kb-explorer-console kb-vocabulary-hub relative flex w-full flex-col overflow-hidden bg-background text-foreground',
        govEmbeddedWorkspaceShell,
        className,
      )}
      data-kb-id={kbId}
    >
      <QueryClientProvider client={hubQueryClient}>
        <ExplorerHostProvider config={config}>
          <OntologyKbProvider kbId={kbId}>
            <Suspense
              fallback={
                <div className="flex flex-1 items-center justify-center gap-2 text-sm text-muted-foreground">
                  <Spinner className="size-4" />
                  {t.kbVocabulary.loadingWorkspace}
                </div>
              }
            >
              <VocabularyWorkspace kbId={kbId} />
            </Suspense>
          </OntologyKbProvider>
        </ExplorerHostProvider>
      </QueryClientProvider>
    </div>
  );
}
