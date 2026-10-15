import { useParams, useSearchParams } from 'react-router-dom';
import { KbGraphWorkspace } from '@/components/kb-graph-workspace.js';
import { KbPageSubtitle } from '@/components/kb-page-subtitle.js';
import { useI18n } from '@/i18n/context.js';

export function KbGraphPage() {
  const { id } = useParams();
  const [searchParams] = useSearchParams();
  const focus = searchParams.get('focus');
  const { t } = useI18n();

  if (!id) {
    return null;
  }

  return (
    <div className="flex min-h-0 flex-1 flex-col">
      <div className="shrink-0 border-b border-border/60 bg-background/80 px-3 py-2 md:px-4">
        <KbPageSubtitle className="text-xs">{t.pages.kbSubtitles.graph}</KbPageSubtitle>
      </div>
      <KbGraphWorkspace kbId={id} focusNodeId={focus} />
    </div>
  );
}
