import { useParams } from 'react-router-dom';
import { KbLibraryWorkspace } from '@/components/kb-library-workspace.js';
import { KbPageSubtitle } from '@/components/kb-page-subtitle.js';
import { PageHeader } from '@/components/console-ui/PageHeader.js';
import { useI18n } from '@/i18n/context.js';
import { useKbCatalog } from '@/lib/kb-context.js';
import { KbExplorerShell } from '@/lib/explorer-context.js';
import { kbPath } from '@/lib/nav-config.js';

export function KbLibraryPage() {
  const { id } = useParams();
  const { t } = useI18n();
  const { getKb } = useKbCatalog();
  if (!id) return null;
  const name = getKb(id)?.name ?? id;

  return (
    <KbExplorerShell>
      <div className="mx-auto flex w-full max-w-6xl flex-col gap-3 p-4 md:p-8">
        <PageHeader
          crumbs={[
            { label: t.menu.platform.kbs, to: '/kbs' },
            { label: name, to: kbPath(id, 'graph') },
            { label: t.menu.kb.sources },
          ]}
        />
        <KbPageSubtitle>{t.pages.kbSubtitles.sources}</KbPageSubtitle>
        <KbLibraryWorkspace kbId={id} />
      </div>
    </KbExplorerShell>
  );
}
