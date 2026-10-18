import { useParams, useSearchParams } from 'react-router-dom';
import { KbProcessingWorkspace } from '@/components/app/kb/workspaces/kb-processing-workspace.js';
import { KbExplorerShell } from '@/lib/explorer-context.js';
import { parseProcessingUrlState } from '@/lib/processingUrlState.js';

export function KbProcessingPage() {
  const { id } = useParams();
  const [searchParams] = useSearchParams();
  const parsed = parseProcessingUrlState(searchParams.toString());

  if (!id) return null;

  return (
    <KbExplorerShell>
      <div className="flex w-full min-w-0 flex-col">
        <KbProcessingWorkspace
          kbId={id}
          jobFocusId={parsed.jobId}
          initialFilter={parsed.filter ?? 'all'}
        />
      </div>
    </KbExplorerShell>
  );
}
