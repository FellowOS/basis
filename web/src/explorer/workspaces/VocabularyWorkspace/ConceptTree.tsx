/**
 * ConceptTree.tsx — react-arborist SKOS hierarchy viewer.
 */
import React, { useLayoutEffect, useRef } from 'react';
import { Tree } from 'react-arborist';
import type { NodeRendererProps } from 'react-arborist';
import { ChevronRight, ChevronDown, Folder, FileText } from 'lucide-react';
import type { ConceptNode } from './types';
import {
  exWsVocabTreeChevron,
  exWsVocabTreeIcon,
  exWsVocabTreeLabel,
  exWsVocabTreeRow,
  exWsVocabTreeShell,
} from '@/lib/explorer-ws-classes.js';

interface ConceptTreeProps {
  data: ConceptNode[];
  onSelectConcept: (concept: ConceptNode) => void;
}

function ConceptTreeNode({
  nodeProps,
  onSelectConcept,
}: {
  nodeProps: NodeRendererProps<ConceptNode>;
  onSelectConcept: (concept: ConceptNode) => void;
}) {
  const { node, style: rowPosition, dragHandle } = nodeProps;
  const rowRef = useRef<HTMLDivElement | null>(null);
  const isFolder = node.children && node.children.length > 0;

  useLayoutEffect(() => {
    const el = rowRef.current;
    if (!el) return;
    Object.assign(el.style, rowPosition);
  });

  const setRowRef = (el: HTMLDivElement | null) => {
    rowRef.current = el;
    if (typeof dragHandle === 'function') {
      dragHandle(el);
    }
  };

  return (
    <div
      ref={setRowRef}
      className={exWsVocabTreeRow}
      data-selected={node.isSelected ? 'true' : 'false'}
      onClick={() => {
        node.toggle();
        onSelectConcept(node.data);
      }}
    >
      <span className={exWsVocabTreeChevron}>
        {isFolder ? (
          node.isOpen ? (
            <ChevronDown size={14} className="text-muted-foreground" />
          ) : (
            <ChevronRight size={14} className="text-muted-foreground" />
          )
        ) : null}
      </span>

      <span className={exWsVocabTreeIcon}>
        {isFolder ? (
          <Folder size={14} className="text-primary" />
        ) : (
          <FileText size={14} className="text-muted-foreground" />
        )}
      </span>

      <span className={exWsVocabTreeLabel}>{node.data.pref_label}</span>
    </div>
  );
}

export const ConceptTree: React.FC<ConceptTreeProps> = ({ data, onSelectConcept }) => {
  return (
    <div className={exWsVocabTreeShell}>
      <Tree
        data={data}
        idAccessor="uri"
        width="100%"
        height={600}
        indent={24}
        rowHeight={36}
        childrenAccessor="children"
      >
        {(nodeProps: NodeRendererProps<ConceptNode>) => (
          <ConceptTreeNode nodeProps={nodeProps} onSelectConcept={onSelectConcept} />
        )}
      </Tree>
    </div>
  );
};
