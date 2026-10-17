import { useParams } from 'react-router-dom';
import { ConsolePageLayout } from '@/components/app/shared/console/index.js';
import { KbDerivedFactsPanel } from '@/components/app/kb/widgets/kb-derived-facts-panel.js';
import { LedgerEntityBrowser } from '@/components/app/kb/ledger/ledger-entity-browser.js';
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
      className="min-h-0 overflow-hidden"
    >
      <div className="grid min-h-0 flex-1 grid-cols-1 gap-4 overflow-auto min-[960px]:grid-cols-[minmax(0,1fr)_minmax(17.5rem,24rem)] min-[960px]:overflow-hidden">
        <div className="min-h-0 min-w-0 min-[960px]:overflow-auto">
          <LedgerEntityBrowser kbId={id} />
        </div>
        <KbDerivedFactsPanel kbId={id} />
      </div>
    </ConsolePageLayout>
  );
}
