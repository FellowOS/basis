import { useParams } from 'react-router-dom';
import { ConsolePageLayout } from '@/components/app/shared/console/index.js';
import { DecisionsPanel } from '@/modules/decisions/pages/panel.js';
import { useI18n } from '@/i18n/context.js';
import { useWorkspaceCatalog } from '@/lib/workspace/context.js';
import { workspacePath } from '@/lib/nav-config.js';

export function DecisionsPage() {
  const { id } = useParams();
  const { t } = useI18n();
  const { getWorkspace } = useWorkspaceCatalog();

  if (!id) {
    return null;
  }

  return (
    <ConsolePageLayout
      crumbs={[
        { label: t.core.workspace_nav.platform.workspaces, to: '/workspaces' },
        { label: getWorkspace(id)?.name ?? id, to: workspacePath(id, 'graph') },
        { label: t.decisions.menu.decisions },
      ]}
      subtitle={t.decisions.page.subtitle}
      className="min-h-0"
    >
      <DecisionsPanel
        workspaceId={id}
        className="min-h-0 flex-1 rounded-lg border border-border"
      />
    </ConsolePageLayout>
  );
}
