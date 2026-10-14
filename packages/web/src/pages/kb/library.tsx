import { useParams } from 'react-router-dom';
import { KbLibraryWorkspace } from '@/components/kb-library-workspace.js';
import { KbExplorerShell } from '@/lib/explorer-context.js';

export function KbLibraryPage() {
  const { id } = useParams();
  if (!id) return null;

  return (
    <KbExplorerShell>
      <KbLibraryWorkspace kbId={id} />
    </KbExplorerShell>
  );
}
