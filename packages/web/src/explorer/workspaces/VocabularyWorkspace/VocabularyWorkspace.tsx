import { useState } from 'react';
import { Sidebar } from './Sidebar';
import { PropertyPanel } from './PropertyPanel';
import type { ConceptNode } from './types';

export function VocabularyWorkspace() {
  const [selectedConcept, setSelectedConcept] = useState<ConceptNode | null>(null);

  return (
    <div className="vocab-layout">
      <Sidebar onSelectConcept={setSelectedConcept} />
      <div className="vocab-main">
        <div className="vocab-detail">
          <PropertyPanel concept={selectedConcept} />
        </div>
      </div>
    </div>
  );
}
