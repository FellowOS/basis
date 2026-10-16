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
  const { t } = useI18n();
  const g = t.kbGraphDiff;
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
              {g.timeRange}
            </Button>
            <Button
              type="button"
              size="sm"
              disabled={pageActions.loading}
              onClick={pageActions.runCompare}
            >
              {pageActions.loading ? <Spinner className="size-4" /> : null}
              {g.compare}
            </Button>
            <Button type="button" size="sm" variant="ghost" asChild>
              <Link to={kbPath(id, 'graph')}>{g.graphLink}</Link>
            </Button>
            {toTime ? (
              <Button type="button" size="sm" variant="ghost" asChild>
                <Link to={kbSearchPath(id, { tab: 'graph', as_of: toTime })}>
                  {g.searchLink}
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
