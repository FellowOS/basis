import { useParams, useSearchParams } from 'react-router-dom';
import { KbGraphWorkspace } from '@/components/kb/workspaces/kb-graph-workspace.js';

export function KbGraphPage() {
  const { id } = useParams();
  const [searchParams] = useSearchParams();
  const focus = searchParams.get('focus');
  const at = searchParams.get('at');

  if (!id) {
    return null;
  }

  return (
    <div className="flex min-h-0 flex-1 flex-col">
      <KbGraphWorkspace kbId={id} focusNodeId={focus} focusAtInstant={at} />
    </div>
  );
}
