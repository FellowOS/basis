import { useParams } from 'react-router-dom';
import { PageHeader } from '@/components/console-ui/PageHeader.js';
import { KbOntologyWorkspace } from '@/components/kb-ontology-workspace.js';
import { useI18n } from '@/i18n/context.js';
import { useKbCatalog } from '@/lib/kb-context.js';
import { kbPath } from '@/lib/nav-config.js';

export function KbOntologyPage() {
  const { id } = useParams();
  const { t } = useI18n();
  const { getKb } = useKbCatalog();

  if (!id) {
    return null;
  }

  return (
    <div className="flex min-h-0 flex-1 flex-col gap-4 overflow-hidden">
      <PageHeader
        crumbs={[
          { label: t.menu.platform.kbs, to: '/kbs' },
          { label: getKb(id)?.name ?? id, to: kbPath(id, 'graph') },
          { label: t.menu.kb.ontology },
        ]}
      />
      <KbOntologyWorkspace
        kbId={id}
        className="min-h-0 flex-1 rounded-lg border border-border"
      />
    </div>
  );
}
