import { useParams } from 'react-router-dom';
import { PageHeader } from '@/components/console-ui/PageHeader.js';
import { LedgerEntityBrowser } from '@/components/ledger-entity-browser.js';
import { useI18n } from '@/i18n/context.js';
import { useKbCatalog } from '@/lib/kb-context.js';
import { kbPath } from '@/lib/nav-config.js';

export function KbEntitiesPage() {
  const { id } = useParams();
  const { t } = useI18n();
  const { getKb } = useKbCatalog();
  if (!id) return null;

  return (
    <div className="space-y-4">
      <PageHeader
        crumbs={[
          { label: t.menu.platform.kbs, to: '/kbs' },
          { label: getKb(id)?.name ?? id, to: kbPath(id, 'graph') },
          { label: t.menu.kb.entities },
        ]}
      />
      <LedgerEntityBrowser kbId={id} />
    </div>
  );
}
