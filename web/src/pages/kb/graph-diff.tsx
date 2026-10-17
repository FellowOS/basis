import { useParams, useSearchParams } from 'react-router-dom';
import { ConsolePageLayout } from '@/components/console-ui/index.js';
import { KbGraphDiffWorkspace } from '@/components/kb/workspaces/kb-graph-diff-workspace.js';
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
    <ConsolePageLayout
      crumbs={[
        { label: t.menu.platform.kbs, to: '/kbs' },
        { label: getKb(id)?.name ?? id, to: kbPath(id, 'graph') },
        { label: t.menu.kb.graphDiff },
      ]}
      subtitle={t.pages.kbSubtitles.graphDiff}
      className="min-h-0 overflow-hidden"
    >
      <KbGraphDiffWorkspace
        kbId={id}
        className="min-h-0 flex-1 overflow-y-auto"
        initialFrom={searchParams.get('from') ?? undefined}
        initialTo={searchParams.get('to') ?? undefined}
      />
    </ConsolePageLayout>
  );
}
