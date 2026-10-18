import { Link, Navigate, useParams, useSearchParams } from 'react-router-dom';
import { ConsolePageLayout } from '@/components/app/shared/console/index.js';
import { KbReviewWorkspace } from '@/components/app/kb/workspaces/kb-review-workspace.js';
import { useI18n } from '@/i18n/context.js';
import { useKbCatalog } from '@/lib/kb-context.js';
import { kbPath } from '@/lib/nav-config.js';

export function KbReviewPage() {
  const { id } = useParams();
  const [searchParams] = useSearchParams();
  const { t } = useI18n();
  const { getKb } = useKbCatalog();

  if (!id) {
    return null;
  }

  const legacyTab = searchParams.get('tab');
  if (legacyTab === 'resolve') {
    return <Navigate to={kbPath(id, 'entity-resolution')} replace />;
  }
  if (legacyTab === 'decisions') {
    const decision = searchParams.get('decision');
    const q = decision ? `?decision=${encodeURIComponent(decision)}` : '';
    return <Navigate to={`${kbPath(id, 'decisions')}${q}`} replace />;
  }

  return (
    <ConsolePageLayout
      crumbs={[
        { label: t.menu.platform.kbs, to: '/kbs' },
        { label: getKb(id)?.name ?? id, to: kbPath(id, 'graph') },
        { label: t.menu.kb.review },
      ]}
      subtitle={
        <>
          {t.pages.kbSubtitles.review}{' '}
          <Link
            to={kbPath(id, 'decisions')}
            className="text-primary underline-offset-2 hover:underline"
            data-testid="review-open-decisions"
          >
            {t.pages.alerts.viewDecisions}
          </Link>
        </>
      }
      className="min-h-0 overflow-hidden"
    >
      <KbReviewWorkspace kbId={id} className="min-h-0 flex-1" />
    </ConsolePageLayout>
  );
}
