import { useCallback } from 'react';
import { useParams, useSearchParams } from 'react-router-dom';
import { KbGraphWorkspace } from '@/components/app/kb/workspaces/kb-graph-workspace.js';
import {
  kbGraphPath,
  mergeKbGraphAtParam,
  parseKbGraphDiffPreviewParams,
} from '@/lib/graphUrlState.js';

export function KbGraphPage() {
  const { id } = useParams();
  const [searchParams, setSearchParams] = useSearchParams();
  const focus = searchParams.get('focus');
  const at = searchParams.get('at');
  const openTimeline = searchParams.get('timeline') === '1';
  const openImportDialog = searchParams.get('import') === '1';
  const openExportDialog = searchParams.get('export') === '1';
  const diffPreview = parseKbGraphDiffPreviewParams(searchParams.toString());
  const focusAtInstant = at ?? diffPreview?.diffTo;

  const onScrubberAtChange = useCallback(
    (atIso: string) => {
      setSearchParams((prev) => mergeKbGraphAtParam(prev.toString(), atIso), { replace: true });
    },
    [setSearchParams],
  );

  if (!id) {
    return null;
  }

  const timelineEntryHref = !openTimeline
    ? kbGraphPath(id, {
        ...(focus ? { focus } : {}),
        ...(at ? { at } : {}),
        timeline: true,
      })
    : undefined;

  return (
    <div className="flex min-h-0 flex-1 flex-col">
      <KbGraphWorkspace
        kbId={id}
        focusNodeId={focus}
        focusAtInstant={focusAtInstant}
        diffPreview={diffPreview ?? undefined}
        openTimelinePanel={openTimeline}
        timelineEntryHref={timelineEntryHref}
        openImportDialog={openImportDialog}
        openExportDialog={openExportDialog}
        onScrubberAtChange={onScrubberAtChange}
      />
    </div>
  );
}
