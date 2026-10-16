import { useParams } from 'react-router-dom';
import { ConsolePageLayout } from '@/components/console-ui/index.js';
import { KbReasoningWorkspace } from '@/components/kb/workspaces/kb-reasoning-workspace.js';
import { useI18n } from '@/i18n/context.js';
import { useKbCatalog } from '@/lib/kb-context.js';
import { kbPath } from '@/lib/nav-config.js';

export function KbReasoningPage() {
  const { id } = useParams();
  const { t } = useI18n();
  const { getKb } = useKbCatalog();

  if (!id) {
    return null;
  }

  return (
    <ConsolePageLayout
      crumbs={[
        { label: t.menu.platform.kbs, to: '/kbs' },
        { label: getKb(id)?.name ?? id, to: kbPath(id, 'graph') },
        { label: t.menu.kb.reasoning },
      ]}
      className="min-h-0 overflow-hidden"
    >
      <KbReasoningWorkspace
        kbId={id}
        className="min-h-0 flex-1 rounded-lg border border-border"
      />
    </ConsolePageLayout>
  );
}
