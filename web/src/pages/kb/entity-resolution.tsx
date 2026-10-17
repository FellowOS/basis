import { useCallback, useState } from 'react';
import { useParams } from 'react-router-dom';
import { ConsolePageLayout } from '@/components/app/shared/console/index.js';
import {
  KbEntityResolutionWorkspace,
  type EntityResolutionPageActions,
} from '@/components/app/kb/workspaces/kb-entity-resolution-workspace.js';
import { Button } from '@/components/ui/button.js';
import { useI18n } from '@/i18n/context.js';
import { useKbCatalog } from '@/lib/kb-context.js';
import { kbPath } from '@/lib/nav-config.js';

export function KbEntityResolutionPage() {
  const { id } = useParams();
  const { t } = useI18n();
  const { getKb } = useKbCatalog();
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
        { label: t.menu.platform.kbs, to: '/kbs' },
        { label: getKb(id)?.name ?? id, to: kbPath(id, 'graph') },
        { label: t.menu.kb.entityResolution },
      ]}
      subtitle={t.pages.kbSubtitles.entityResolution}
      actions={
        pageActions ? (
          <Button type="button" size="sm" onClick={pageActions.openDedupScan}>
            {t.entityResolution.dedupScan}
          </Button>
        ) : undefined
      }
      className="min-h-0"
    >
      <KbEntityResolutionWorkspace
        kbId={id}
        className="min-h-0 flex-1 rounded-lg border border-border"
        onPageActionsChange={onPageActionsChange}
      />
    </ConsolePageLayout>
  );
}
