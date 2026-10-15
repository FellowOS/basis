import { useParams } from 'react-router-dom';
import { ConsolePageLayout } from '@/components/console-ui/index.js';
import { KbDerivedFactsPanel } from '@/components/kb/widgets/kb-derived-facts-panel.js';
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
    <ConsolePageLayout
      crumbs={[
        { label: t.menu.platform.kbs, to: '/kbs' },
        { label: getKb(id)?.name ?? id, to: kbPath(id, 'graph') },
        { label: t.menu.kb.entities },
      ]}
      subtitle={t.pages.kbSubtitles.entities}
    >
      <KbDerivedFactsPanel kbId={id} />
      <LedgerEntityBrowser kbId={id} />
    </ConsolePageLayout>
  );
}
