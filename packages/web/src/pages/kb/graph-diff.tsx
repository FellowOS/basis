import { useParams, useSearchParams } from 'react-router-dom';
import { KbGraphDiffWorkspace } from '@/components/kb-graph-diff-workspace.js';
import { KbPageSubtitle } from '@/components/kb-page-subtitle.js';
import { PageHeader } from '@/components/console-ui/PageHeader.js';
import { useI18n } from '@/i18n/context.js';
import { useKbCatalog } from '@/lib/kb-context.js';
import { kbPath } from '@/lib/nav-config.js';

export function KbGraphDiffPage() {
  const { id } = useParams();
  const [searchParams] = useSearchParams();
  const { t } = useI18n();
  const { getKb } = useKbCatalog();
  if (!id) return null;

  return (
    <div className="flex min-h-0 flex-1 flex-col gap-4">
      <PageHeader
        crumbs={[
          { label: t.menu.platform.kbs, to: '/kbs' },
          { label: getKb(id)?.name ?? id, to: kbPath(id, 'graph') },
          { label: t.menu.kb.graphDiff },
        ]}
      />
      <KbPageSubtitle>{t.pages.kbSubtitles.graphDiff}</KbPageSubtitle>
      <KbGraphDiffWorkspace
        kbId={id}
        className="min-h-0 flex-1"
        initialFrom={searchParams.get('from') ?? undefined}
        initialTo={searchParams.get('to') ?? undefined}
      />
    </div>
  );
}
