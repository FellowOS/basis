import type { ConceptNode } from './types';
import {
  ontVocabEmptyTitle,
  ontVocabPropAltChip,
  ontVocabPropBody,
  ontVocabPropCard,
  ontVocabPropCardLabel,
  ontVocabPropChipRow,
  ontVocabPropEmptyNarrower,
  ontVocabPropHeader,
  ontVocabPropKicker,
  ontVocabPropNarrowerItem,
  ontVocabPropNarrowerList,
  ontVocabPropSection,
  ontVocabPropTitle,
  ontVocabPropUri,
} from '../OntologyWorkspace/ontologyUiClasses.js';

interface PropertyPanelProps {
  concept: ConceptNode | null;
}

export function PropertyPanel({ concept }: PropertyPanelProps) {
  if (!concept) {
    return (
      <div className="vocab-empty">
        <p className={ontVocabEmptyTitle}>No concept selected</p>
        <p className="oh-muted">Click a concept in the tree to view its properties.</p>
      </div>
    );
  }

  return (
    <div>
      <div className={ontVocabPropHeader}>
        <div className={ontVocabPropKicker}>SKOS Concept</div>
        <h2 className={ontVocabPropTitle}>{concept.pref_label}</h2>
      </div>

      <div className={ontVocabPropUri}>{concept.uri}</div>

      {concept.alt_labels && concept.alt_labels.length > 0 && (
        <section className={ontVocabPropSection}>
          <h4 className="oh-label">Alternative labels</h4>
          <div className={ontVocabPropChipRow}>
            {concept.alt_labels.map((lbl, i) => (
              <span key={i} className={ontVocabPropAltChip}>
                {lbl}
              </span>
            ))}
          </div>
        </section>
      )}

      {concept.description && (
        <section className={ontVocabPropSection}>
          <h4 className="oh-label">Description</h4>
          <p className={ontVocabPropBody}>{concept.description}</p>
        </section>
      )}

      <section className={ontVocabPropCard}>
        <h4 className={ontVocabPropCardLabel}>Narrower concepts</h4>
        {concept.children && concept.children.length > 0 ? (
          <div className={ontVocabPropNarrowerList}>
            {concept.children.map((child) => (
              <span key={child.uri} className={ontVocabPropNarrowerItem}>
                {child.pref_label}
              </span>
            ))}
          </div>
        ) : (
          <p className={ontVocabPropEmptyNarrower}>Leaf concept — no narrower concepts.</p>
        )}
      </section>
    </div>
  );
}
