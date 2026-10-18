import { useState } from 'react';
import { exWsPageRow } from '@/lib/ui-classes/explorer-ws.js';
import { Sidebar } from './Sidebar';
import { PropertyPanel } from './PropertyPanel';
import type { ConceptNode } from './types';
import { VocabularyKbProvider } from './vocabularyKb';

export function VocabularyWorkspace({ kbId }: { kbId: string }) {
  const [selectedConcept, setSelectedConcept] = useState<ConceptNode | null>(null);

  return (
    <VocabularyKbProvider kbId={kbId}>
      <div className={exWsPageRow}>
        <Sidebar onSelectConcept={setSelectedConcept} />
        <PropertyPanel concept={selectedConcept} onSelectConcept={setSelectedConcept} />
      </div>
    </VocabularyKbProvider>
  );
}
