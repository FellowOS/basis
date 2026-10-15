import { useParams } from 'react-router-dom';
import { KbLibraryWorkspace } from '@/components/kb/workspaces/kb-library-workspace.js';
import { KbExplorerShell } from '@/lib/explorer-context.js';

export function KbLibraryPage() {
  const { id } = useParams();
  if (!id) return null;

  return (
    <KbExplorerShell>
      <div className="flex w-full flex-col">
        <KbLibraryWorkspace kbId={id} />
      </div>
    </KbExplorerShell>
  );
}
