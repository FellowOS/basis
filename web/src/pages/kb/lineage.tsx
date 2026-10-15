import { useParams } from 'react-router-dom';
import { ConsolePageLayout } from '@/components/console-ui/index.js';
import { KbLineageWorkspace } from '@/components/kb/workspaces/kb-lineage-workspace.js';
import { useI18n } from '@/i18n/context.js';
import { useKbCatalog } from '@/lib/kb-context.js';
import { kbPath } from '@/lib/nav-config.js';

export function KbLineagePage() {
  const { id } = useParams();
  const { t } = useI18n();
  const { getKb } = useKbCatalog();
  if (!id) return null;

  return (
    <ConsolePageLayout
      crumbs={[
        { label: t.menu.platform.kbs, to: '/kbs' },
        { label: getKb(id)?.name ?? id, to: kbPath(id, 'graph') },
        { label: t.menu.kb.lineage },
      ]}
      subtitle={t.pages.kbSubtitles.lineage}
      className="min-h-0"
    >
      <KbLineageWorkspace kbId={id} className="min-h-0 flex-1" />
    </ConsolePageLayout>
  );
}
