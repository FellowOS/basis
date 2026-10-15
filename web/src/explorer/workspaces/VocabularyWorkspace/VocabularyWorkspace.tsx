import { useState } from 'react';
import { Sidebar } from './Sidebar';
import { PropertyPanel } from './PropertyPanel';
import type { ConceptNode } from './types';
import { VocabularyKbProvider } from './vocabularyKb';

export function VocabularyWorkspace({ kbId }: { kbId: string }) {
  const [selectedConcept, setSelectedConcept] = useState<ConceptNode | null>(null);

  return (
    <VocabularyKbProvider kbId={kbId}>
    <div className="vocab-layout">
      <Sidebar onSelectConcept={setSelectedConcept} />
      <div className="vocab-main">
        <div className="vocab-detail">
          <PropertyPanel concept={selectedConcept} />
        </div>
      </div>
    </div>
    </VocabularyKbProvider>
  );
}
