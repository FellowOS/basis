import { useCallback, useState } from 'react';
import { Link, useParams, useSearchParams } from 'react-router-dom';
import { ConsolePageLayout } from '@/components/console-ui/index.js';
import {
  KbGraphDiffWorkspace,
  type GraphDiffPageActions,
} from '@/components/kb/workspaces/kb-graph-diff-workspace.js';
import { Button } from '@/components/ui/button.js';
import { Spinner } from '@/components/ui/spinner.js';
import { useI18n } from '@/i18n/context.js';
import { useKbCatalog } from '@/lib/kb-context.js';
import { kbPath } from '@/lib/nav-config.js';
import { kbSearchPath } from '@/lib/searchUrlState.js';

export function KbGraphDiffPage() {
  const { id } = useParams();
  const [searchParams] = useSearchParams();
  const { t, locale } = useI18n();
  const zh = locale === 'zh';
  const { getKb } = useKbCatalog();
  const [pageActions, setPageActions] = useState<GraphDiffPageActions | null>(null);
  const onPageActionsChange = useCallback((actions: GraphDiffPageActions | null) => {
    setPageActions(actions);
  }, []);

  if (!id) return null;

  const toTime = searchParams.get('to')?.trim() ?? '';

  return (
    <ConsolePageLayout
      crumbs={[
        { label: t.menu.platform.kbs, to: '/kbs' },
        { label: getKb(id)?.name ?? id, to: kbPath(id, 'graph') },
        { label: t.menu.kb.graphDiff },
      ]}
      subtitle={t.pages.kbSubtitles.graphDiff}
      meta={
        pageActions ? (
          <span className="font-mono text-xs">{pageActions.rangeSummary}</span>
        ) : undefined
      }
      actions={
        pageActions ? (
          <>
            <Button type="button" size="sm" variant="outline" onClick={pageActions.openRange}>
              {zh ? '时间范围' : 'Time range'}
            </Button>
            <Button
              type="button"
              size="sm"
              disabled={pageActions.loading}
              onClick={pageActions.runCompare}
            >
              {pageActions.loading ? <Spinner className="size-4" /> : null}
              {zh ? '对比' : 'Compare'}
            </Button>
            <Button type="button" size="sm" variant="ghost" asChild>
              <Link to={kbPath(id, 'graph')}>{zh ? '图谱' : 'Graph'}</Link>
            </Button>
            {toTime ? (
              <Button type="button" size="sm" variant="ghost" asChild>
                <Link to={kbSearchPath(id, { tab: 'graph', as_of: toTime })}>
                  {zh ? '搜索' : 'Search'}
                </Link>
              </Button>
            ) : null}
          </>
        ) : undefined
      }
      className="min-h-0"
    >
      <KbGraphDiffWorkspace
        kbId={id}
        className="min-h-0 flex-1"
        initialFrom={searchParams.get('from') ?? undefined}
        initialTo={searchParams.get('to') ?? undefined}
        pageActionsInHeader
        onPageActionsChange={onPageActionsChange}
      />
    </ConsolePageLayout>
  );
}
