/**
 * Left sidebar for the Vocabulary workspace.
 */
import { useState } from 'react';
import { useVocabularies, useConceptHierarchy } from './queries';
import { ConceptTree } from './ConceptTree';
import { ImportDropzone } from './ImportDropzone';
import type { ConceptNode, VocabularyScheme } from './types';

interface SidebarProps {
  onSelectConcept: (concept: ConceptNode) => void;
}

export function Sidebar({ onSelectConcept }: SidebarProps) {
  const { data: schemes = [], isLoading: schemesLoading } = useVocabularies();
  const [activeScheme, setActiveScheme] = useState<string | undefined>();

  const selectedSchemeUri = activeScheme ?? schemes[0]?.uri;

  const {
    data: hierarchy = [],
    isLoading: treeLoading,
  } = useConceptHierarchy(selectedSchemeUri);

  return (
    <div className="vocab-sidebar">
      <div className="vocab-sidebar-header">
        <h2 className="vocab-sidebar-title">SKOS vocabulary</h2>
        <p className="vocab-sidebar-sub">
          {schemes.length
            ? `${schemes.length} scheme${schemes.length > 1 ? 's' : ''}`
            : 'No vocabularies loaded'}
        </p>
      </div>

      <div className="vocab-sidebar-section">
        {schemesLoading ? (
          <div className="oh-muted">Loading schemes…</div>
        ) : schemes.length === 0 ? (
          <div className="oh-muted" style={{ fontStyle: 'italic' }}>
            No schemes found. Import a .ttl or .rdf file below.
          </div>
        ) : (
          <select
            className="oh-field"
            value={selectedSchemeUri || ''}
            onChange={(e) => setActiveScheme(e.target.value)}
          >
            {schemes.map((s: VocabularyScheme) => (
              <option key={s.uri} value={s.uri}>
                {s.label}
              </option>
            ))}
          </select>
        )}
      </div>

      <div style={{ flex: 1, overflow: 'hidden', display: 'flex', flexDirection: 'column', minHeight: 0 }}>
        {treeLoading ? (
          <div className="oh-muted" style={{ padding: 20, textAlign: 'center' }}>
            Loading hierarchy…
          </div>
        ) : hierarchy.length === 0 ? (
          <div className="oh-muted" style={{ padding: 20, textAlign: 'center', fontStyle: 'italic' }}>
            {selectedSchemeUri
              ? 'No concepts found in this scheme.'
              : 'Select a scheme to browse concepts.'}
          </div>
        ) : (
          <div style={{ flex: 1, overflow: 'hidden', minHeight: 0 }}>
            <ConceptTree data={hierarchy} onSelectConcept={onSelectConcept} />
          </div>
        )}
      </div>

      <div className="vocab-sidebar-section" style={{ borderBottom: 'none', borderTop: '1px solid var(--ws-border)' }}>
        <ImportDropzone />
      </div>
    </div>
  );
}
