import { useCallback, useState } from 'react';
import { useParams } from 'react-router-dom';
import { ConsolePageLayout } from '@/components/app/shared/console/index.js';
import {
  EntityResolutionPanel,
  type EntityResolutionPageActions,
} from '@/modules/entity-resolution/pages/panel.js';
import { Button } from '@/components/ui/button.js';
import { useI18n } from '@/i18n/context.js';
import { useWorkspaceCatalog } from '@/lib/workspace/context.js';
import { workspacePath } from '@/lib/nav-config.js';

export function EntityResolutionPage() {
  const { id } = useParams();
  const { t } = useI18n();
  const { getWorkspace } = useWorkspaceCatalog();
  const [pageActions, setPageActions] = useState<EntityResolutionPageActions | null>(null);
  const onPageActionsChange = useCallback((actions: EntityResolutionPageActions | null) => {
    setPageActions(actions);
  }, []);

  if (!id) {
    return null;
  }

  return (
    <ConsolePageLayout
      crumbs={[
        { label: t.core.workspace_nav.platform.workspaces, to: '/workspaces' },
        { label: getWorkspace(id)?.name ?? id, to: workspacePath(id, 'graph') },
        { label: t.entity_resolution.menu.entity_resolution },
      ]}
      subtitle={t.entity_resolution.page.subtitle}
      actions={
        pageActions ? (
          <Button type="button" size="sm" onClick={pageActions.openDedupScan}>
            {t.entity_resolution.page.dedup_scan}
          </Button>
        ) : undefined
      }
      className="min-h-0"
    >
      <EntityResolutionPanel
        workspaceId={id}
        className="min-h-0 flex-1 rounded-lg border border-border"
        onPageActionsChange={onPageActionsChange}
      />
    </ConsolePageLayout>
  );
}
