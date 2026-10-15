import { LedgerEvidenceInspector } from '@/components/ledger-evidence-inspector.js';
import { KnowledgePage } from '@/pages/knowledge.js';

export function KbLibraryWorkspace({ kbId }: { kbId: string }) {
  return (
    <div
      className="kb-library-workspace flex min-h-0 w-full flex-1 flex-col"
      data-kb-id={kbId}
    >
      <LedgerEvidenceInspector kbId={kbId} />
      <KnowledgePage />
    </div>
  );
}
