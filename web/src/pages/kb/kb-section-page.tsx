import { useParams } from 'react-router-dom';
import { PlaceholderPage } from '@/components/placeholder-page.js';
import { useI18n } from '@/i18n/context.js';
import { useKbCatalog } from '@/lib/kb-context.js';
import type { KbNavKey } from '@/lib/nav-config.js';

export function KbSectionPage({ section }: { section: KbNavKey }) {
  const { id } = useParams();
  const { t } = useI18n();
  const { getKb } = useKbCatalog();
  const kb = id ? getKb(id) : undefined;
  const name = kb?.name ?? id ?? t.common.ellipsis;
  const sectionLabel = t.menu.kb[section];

  return (
    <PlaceholderPage
      title={sectionLabel}
      crumbs={[
        { label: t.menu.platform.kbs, to: '/kbs' },
        { label: name, to: id ? `/kbs/${id}/graph` : '/kbs' },
        { label: sectionLabel },
      ]}
    />
  );
}
