import { useState } from 'react';
import { Navigate, useLocation, useNavigate } from 'react-router-dom';
import { EmptyState } from '@/components/app/shared/console/index.js';
import { ConsolePageLayout } from '@/components/app/shared/console/ConsolePageLayout.js';
import { Button } from '@/components/ui/button.js';
import { KbCreateDialog } from '@/components/app/kb/explorer-shell/kb-create-dialog.js';
import { useI18n } from '@/i18n/context.js';
import { pickDefaultKbId, writeActiveKbId } from '@/lib/kb-active-id.js';
import { useKbCatalog } from '@/lib/kb-context.js';
import { KB_NAV, kbPath } from '@/lib/nav-config.js';
export function KbSetupWorkspacePage() {
  const { t } = useI18n();
  const p = t.pages.basisKbs;
  const { pathname } = useLocation();
  const navigate = useNavigate();
  const { kbs, loading, refresh } = useKbCatalog();
  const [createOpen, setCreateOpen] = useState(false);

  const segment = /^\/kbs\/setup\/([^/]+)/.exec(pathname)?.[1] ?? 'graph';
  const navItem = KB_NAV.find((item) => item.segment === segment);
  const sectionTitle = navItem ? t.menu.kb[navItem.labelKey] : t.menu.kb.graph;

  const defaultId = pickDefaultKbId(kbs);
  if (!loading && defaultId) {
    return <Navigate to={kbPath(defaultId, segment === 'graph' ? 'graph' : segment)} replace />;
  }

  async function onCreated(kb: { id: string }) {
    writeActiveKbId(kb.id);
    await refresh();
    navigate(kbPath(kb.id, 'graph'), { replace: true });
  }

  return (
    <ConsolePageLayout
      crumbs={[
        { label: t.menu.platform.kbs, to: kbPath('setup', 'graph') },
        { label: sectionTitle },
      ]}
    >
      <EmptyState
        title={p.emptyTitle}
        description={p.emptyDescription}
        action={
          <Button type="button" size="sm" onClick={() => setCreateOpen(true)}>
            {p.createKb}
          </Button>
        }
      />
      <KbCreateDialog open={createOpen} onOpenChange={setCreateOpen} onCreated={onCreated} />
    </ConsolePageLayout>
  );
}
