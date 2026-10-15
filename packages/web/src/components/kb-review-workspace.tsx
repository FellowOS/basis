import { lazy, Suspense, useEffect, useMemo, useState } from 'react';
import { useSearchParams } from 'react-router-dom';
import { QueryClient, QueryClientProvider } from '@tanstack/react-query';
import { ExplorerHostProvider } from '@/explorer/host/explorerHttp.js';
import { buildKbExplorerHttpConfig } from '@/lib/kb-explorer-host.js';
import { useKbCapabilities } from '@/lib/kb-capabilities.js';
import { KbExplorerUnavailable } from '@/components/kb-explorer-unavailable.js';
import { KbExplorerZoneTabs } from '@/components/kb-explorer-zone-tabs.js';
import { KbReviewQueueTab } from '@/components/kb-review-queue-tab.js';
import { Spinner } from '@/components/ui/spinner.js';
import { useI18n } from '@/i18n/context.js';
import { cn } from '@/lib/utils.js';
import { parseReviewUrlState } from '@/lib/reviewUrlState.js';
import '@/explorer/ui/primitives.css';

const EntityResolutionTab = lazy(() =>
  import('@/explorer/workspaces/EnrichWorkspace/EntityResolutionTab.js').then((module) => ({
    default: module.EntityResolutionTab,
  })),
);

const DecisionWorkspace = lazy(() =>
  import('@/explorer/workspaces/DecisionWorkspace/DecisionWorkspace.js').then((module) => ({
    default: module.DecisionWorkspace,
  })),
);

type ReviewTab = 'resolve' | 'decisions' | 'queue';

const reviewQueryClient = new QueryClient({
  defaultOptions: {
    queries: { retry: 1, refetchOnWindowFocus: false },
  },
});

export function KbReviewWorkspace({
  kbId,
  className,
}: {
  kbId: string;
  className?: string;
}) {
  const { locale } = useI18n();
  const [searchParams, setSearchParams] = useSearchParams();
  const { caps, loading: capsLoading } = useKbCapabilities();
  const config = useMemo(() => buildKbExplorerHttpConfig(kbId), [kbId]);

  const reviewUrl = parseReviewUrlState(searchParams.toString());
  const tabFromUrl = reviewUrl.tab ?? searchParams.get('tab');
  const reviewFocusItemId = reviewUrl.reviewItemId?.trim() || '';
  const initialTab: ReviewTab =
    tabFromUrl === 'decisions' || tabFromUrl === 'queue' || tabFromUrl === 'resolve'
      ? tabFromUrl
      : reviewFocusItemId
        ? 'queue'
        : 'resolve';
  const [tab, setTab] = useState<ReviewTab>(initialTab);

  useEffect(() => {
    if (
      tabFromUrl === 'decisions' ||
      tabFromUrl === 'queue' ||
      tabFromUrl === 'resolve'
    ) {
      setTab(tabFromUrl);
      return;
    }
    if (reviewFocusItemId) {
      setTab('queue');
    }
  }, [tabFromUrl, reviewFocusItemId]);

  function changeTab(next: ReviewTab) {
    setTab(next);
    const params = new URLSearchParams(searchParams);
    params.set('tab', next);
    setSearchParams(params, { replace: true });
  }

  const decisionsQuery = searchParams.get('q') ?? '';
  const decisionsFocusId = searchParams.get('decision') ?? '';

  const tabs = useMemo(
    () => [
      {
        id: 'resolve' as const,
        label: locale === 'zh' ? '实体解析' : 'Entity resolution',
      },
      { id: 'decisions' as const, label: locale === 'zh' ? '决策记录' : 'Decisions' },
      { id: 'queue' as const, label: locale === 'zh' ? '审核队列' : 'Review queue' },
    ],
    [locale],
  );

  if (!capsLoading && caps && !caps.enrichment && !caps.decisions) {
    return <KbExplorerUnavailable kbId={kbId} feature="review" />;
  }

  return (
    <div
      className={cn(
        'kb-explorer-console kb-review-workspace relative flex min-h-0 w-full flex-1 flex-col overflow-hidden bg-background text-foreground',
        className,
      )}
      data-kb-id={kbId}
    >
      <QueryClientProvider client={reviewQueryClient}>
      <ExplorerHostProvider config={config}>
        <KbExplorerZoneTabs
          variant="console"
          tabs={tabs}
          activeId={tab}
          onChange={(id) => changeTab(id as ReviewTab)}
        />
        <Suspense
          fallback={
            <div className="flex flex-1 items-center justify-center gap-2 text-sm text-muted-foreground">
              <Spinner className="size-4" />
              {locale === 'zh' ? '加载审核工作台…' : 'Loading review workspace…'}
            </div>
          }
        >
          <div className="flex min-h-0 flex-1 flex-col">
            {tab === 'resolve' ? (
              <EntityResolutionTab kbId={kbId} />
            ) : tab === 'decisions' ? (
              <DecisionWorkspace
                kbId={kbId}
                initialFilter={decisionsQuery}
                selectDecisionId={decisionsFocusId || undefined}
              />
            ) : (
              <KbReviewQueueTab kbId={kbId} focusItemId={reviewFocusItemId || undefined} />
            )}
          </div>
        </Suspense>
      </ExplorerHostProvider>
      </QueryClientProvider>
    </div>
  );
}
