import { useParams, useSearchParams } from 'react-router-dom';
import { ProcessingScreen } from '@/modules/processing/pages/screen.js';
import { WorkspaceRouteShell } from '@/lib/workspace/ws-context.js';
import { parseProcessingUrlState } from '@/modules/processing/lib/processingUrlState.js';

export function ProcessingPage() {
  const { id } = useParams();
  const [searchParams] = useSearchParams();
  const parsed = parseProcessingUrlState(searchParams.toString());

  if (!id) return null;

  return (
    <WorkspaceRouteShell>
      <div className="flex w-full min-w-0 flex-col">
        <ProcessingScreen
          workspaceId={id}
          jobFocusId={parsed.jobId}
          initialFilter={parsed.filter ?? 'all'}
        />
      </div>
    </WorkspaceRouteShell>
  );
}
