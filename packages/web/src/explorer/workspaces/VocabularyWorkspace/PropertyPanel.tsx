import type { ConceptNode } from './types';

interface PropertyPanelProps {
  concept: ConceptNode | null;
}

export function PropertyPanel({ concept }: PropertyPanelProps) {
  if (!concept) {
    return (
      <div className="vocab-empty">
        <p style={{ fontSize: 15, fontWeight: 600, marginBottom: 4, color: 'var(--ws-text)' }}>
          No concept selected
        </p>
        <p className="oh-muted">Click a concept in the tree to view its properties.</p>
      </div>
    );
  }

  return (
    <div>
      <div style={{ borderBottom: '1px solid var(--ws-border)', paddingBottom: 16, marginBottom: 20 }}>
        <div className="oh-kicker" style={{ marginBottom: 8 }}>SKOS Concept</div>
        <h2 className="oh-title" style={{ fontSize: '1.25rem', wordBreak: 'break-word' }}>
          {concept.pref_label}
        </h2>
      </div>

      <div
        className="oh-mono"
        style={{
          marginBottom: 20,
          padding: '8px 12px',
          borderRadius: 'var(--radius)',
          border: '1px solid var(--ws-border)',
          background: 'color-mix(in oklch, var(--muted) 30%, var(--card))',
        }}
      >
        {concept.uri}
      </div>

      {concept.alt_labels && concept.alt_labels.length > 0 && (
        <section style={{ marginBottom: 24 }}>
          <h4 className="oh-label">Alternative labels</h4>
          <div style={{ display: 'flex', gap: 8, flexWrap: 'wrap' }}>
            {concept.alt_labels.map((lbl, i) => (
              <span
                key={i}
                className="ws-pill ws-pill--mono"
                style={{ fontSize: 13, padding: '4px 10px' }}
              >
                {lbl}
              </span>
            ))}
          </div>
        </section>
      )}

      {concept.description && (
        <section style={{ marginBottom: 24 }}>
          <h4 className="oh-label">Description</h4>
          <p className="oh-muted" style={{ lineHeight: 1.6 }}>{concept.description}</p>
        </section>
      )}

      <section className="oh-card" style={{ padding: 14 }}>
        <h4 className="oh-label" style={{ marginTop: 0 }}>Narrower concepts</h4>
        {concept.children && concept.children.length > 0 ? (
          <div style={{ display: 'flex', flexDirection: 'column', gap: 6 }}>
            {concept.children.map((child) => (
              <span
                key={child.uri}
                style={{
                  fontSize: 13,
                  padding: '6px 10px',
                  borderRadius: 'var(--radius)',
                  border: '1px solid var(--ws-border)',
                  background: 'var(--background)',
                  color: 'var(--ws-text)',
                }}
              >
                {child.pref_label}
              </span>
            ))}
          </div>
        ) : (
          <p className="oh-muted" style={{ fontStyle: 'italic' }}>
            Leaf concept — no narrower concepts.
          </p>
        )}
      </section>
    </div>
  );
}
