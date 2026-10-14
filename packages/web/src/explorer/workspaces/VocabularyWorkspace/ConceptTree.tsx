/**
 * ConceptTree.tsx — react-arborist SKOS hierarchy viewer.
 *
 * Styled for the Palantir/Glassmorphism dark theme rather than
 * the default light-mode colours.
 */
import React from 'react';
import { Tree } from 'react-arborist';
import type { NodeRendererProps } from 'react-arborist';
import { ChevronRight, ChevronDown, Folder, FileText } from 'lucide-react';
import type { ConceptNode } from './types';

interface ConceptTreeProps {
  data: ConceptNode[];
  onSelectConcept: (concept: ConceptNode) => void;
}

export const ConceptTree: React.FC<ConceptTreeProps> = ({ data, onSelectConcept }) => {
  return (
    <div style={{
      height: '100%', width: '100%',
      backgroundColor: 'transparent',
      overflow: 'hidden',
    }}>
      <Tree
        data={data}
        idAccessor="uri"
        width="100%"
        height={600}
        indent={24}
        rowHeight={36}
        childrenAccessor="children"
      >
        {(nodeProps: NodeRendererProps<ConceptNode>) => {
          const { node, style, dragHandle } = nodeProps;
          const isFolder = node.children && node.children.length > 0;

          return (
            <div
              ref={dragHandle}
              className="vocab-tree-row"
              data-selected={node.isSelected ? 'true' : 'false'}
              onClick={() => {
                node.toggle();
                onSelectConcept(node.data);
              }}
              style={{
                ...style,
                display: 'flex',
                alignItems: 'center',
                padding: '0 8px',
                cursor: 'pointer',
                userSelect: 'none',
              }}
            >
              <span style={{ width: 20, display: 'flex', justifyContent: 'center' }}>
                {isFolder ? (
                  node.isOpen
                    ? <ChevronDown size={14} className="text-muted-foreground" />
                    : <ChevronRight size={14} className="text-muted-foreground" />
                ) : null}
              </span>

              <span style={{ marginRight: 8, display: 'flex', alignItems: 'center' }}>
                {isFolder
                  ? <Folder size={14} className="text-primary" />
                  : <FileText size={14} className="text-muted-foreground" />
                }
              </span>

              <span style={{
                fontSize: 13,
                color: 'var(--ws-text)',
                whiteSpace: 'nowrap',
                overflow: 'hidden',
                textOverflow: 'ellipsis',
              }}>
                {node.data.pref_label}
              </span>
            </div>
          );
        }}
      </Tree>
    </div>
  );
};