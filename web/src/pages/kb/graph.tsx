import { useCallback } from 'react';
import { useParams, useSearchParams } from 'react-router-dom';
import { KbGraphWorkspace } from '@/components/app/kb/workspaces/kb-graph-workspace.js';
import { mergeKbGraphAtParam } from '@/lib/graphUrlState.js';

export function KbGraphPage() {
  const { id } = useParams();
  const [searchParams, setSearchParams] = useSearchParams();
  const focus = searchParams.get('focus');
  const at = searchParams.get('at');
  const openTimeline = searchParams.get('timeline') === '1';

  const onScrubberAtChange = useCallback(
    (atIso: string) => {
      const next = mergeKbGraphAtParam(searchParams.toString(), atIso);
      setSearchParams(next, { replace: true });
    },
    [searchParams, setSearchParams],
  );

  if (!id) {
    return null;
  }

  return (
    <div className="flex min-h-0 flex-1 flex-col">
      <KbGraphWorkspace
        kbId={id}
        focusNodeId={focus}
        focusAtInstant={at}
        openTimelinePanel={openTimeline}
        onScrubberAtChange={onScrubberAtChange}
      />
    </div>
  );
}
