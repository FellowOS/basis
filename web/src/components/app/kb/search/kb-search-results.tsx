import type { ReactNode } from 'react';
import { Link } from 'react-router-dom';
import { EmptyState } from '@/components/app/shared/console/index.js';
import {
  ledgerEntityId,
  type LedgerEntityHit,
} from '@/components/app/kb/ledger/ledger-entity-browser.js';
import { fmt, formatLocaleFixedDecimals } from '@/i18n/format.js';
import type { Locale } from '@/i18n/locale.js';
import type { LocaleMessages } from '@/i18n/locales/en/index.js';
import { formatNodeRefDetail } from '@/lib/format-node-ref.js';
import { kbPath } from '@/lib/nav-config.js';
import { kbGraphPath } from '@/lib/graphUrlState.js';
import { graphNodeTypeLabel } from '@/workspaces/GraphWorkspace/graphWorkspaceCopy.js';

export type GraphSearchHit = {
  node: { id: string; type: string; content: string };
  score: number;
};

export type ChunkHit = {
  chunk_id: string;
  document_id: string;
  document_title: string;
  snippet: string;
  ordinal: number;
};

type KbSearchCopy = LocaleMessages['kbSearch'];

const titleLinkClass =
  'text-[15px] leading-snug text-primary underline-offset-2 hover:underline';

const metaLineClass = 'mt-0.5 text-xs leading-snug text-muted-foreground';

const snippetClass = 'mt-1 text-sm leading-relaxed text-foreground/85 line-clamp-3';

const secondaryLinkClass =
  'mt-1.5 inline-block text-xs text-muted-foreground underline-offset-2 hover:text-primary hover:underline';

function SearchResultList({ children }: { children: ReactNode }) {
  return <ul className="flex flex-col">{children}</ul>;
}

function SearchResultItem({ children }: { children: ReactNode }) {
  return <li className="border-b border-border/50 py-4 last:border-b-0">{children}</li>;
}

export function KbSearchChunkList({
  kbId,
  hits,
  copy,
  emptyCell,
}: {
  kbId: string;
  hits: ChunkHit[];
  copy: KbSearchCopy;
  emptyCell: string;
}) {
  if (hits.length === 0) {
    return <EmptyState title={copy.noResults} />;
  }
  const evidenceHref = (chunkId: string) =>
    `${kbPath(kbId, 'sources')}?chunk=${encodeURIComponent(chunkId)}`;

  return (
    <SearchResultList>
      {hits.map((hit) => (
        <SearchResultItem key={hit.chunk_id}>
          <Link to={evidenceHref(hit.chunk_id)} className={titleLinkClass}>
            {hit.document_title || hit.document_id}
          </Link>
          <p className={metaLineClass}>
            {fmt(copy.chunkMeta, { ordinal: hit.ordinal, chunkId: hit.chunk_id })}
          </p>
          {hit.snippet ? (
            <p className={snippetClass}>{hit.snippet}</p>
          ) : (
            <p className={`${snippetClass} text-muted-foreground`}>{emptyCell}</p>
          )}
          <Link to={evidenceHref(hit.chunk_id)} className={secondaryLinkClass}>
            {copy.evidence}
          </Link>
        </SearchResultItem>
      ))}
    </SearchResultList>
  );
}

export function KbSearchGraphList({
  kbId,
  hits,
  labels,
  copy,
  locale,
  graphAt,
}: {
  kbId: string;
  hits: GraphSearchHit[];
  labels: Record<string, string | null>;
  copy: KbSearchCopy;
  locale: Locale;
  /** Pass search page `at` into graph deep links (F-SRCH-03). */
  graphAt?: string;
}) {
  if (hits.length === 0) {
    return <EmptyState title={copy.noResults} />;
  }
  return (
    <SearchResultList>
      {hits.map((hit) => {
        const { title, subtitle } = formatNodeRefDetail(hit.node.id, labels);
        const typeLabel = graphNodeTypeLabel(locale, hit.node.type);
        const scoreLabel = formatLocaleFixedDecimals(locale, hit.score, 3);
        const graphHref = kbGraphPath(kbId, {
          focus: hit.node.id,
          ...(graphAt?.trim() ? { at: graphAt.trim() } : {}),
        });
        const showContent =
          hit.node.content && hit.node.content !== labels[hit.node.id];
        return (
          <SearchResultItem key={hit.node.id}>
            <Link to={graphHref} className={titleLinkClass}>
              {title}
            </Link>
            <p className={metaLineClass}>
              {subtitle ? `${subtitle} · ` : null}
              {fmt(copy.graphScoreLine, { type: typeLabel, score: scoreLabel })}
            </p>
            {showContent ? <p className={snippetClass}>{hit.node.content}</p> : null}
            <Link to={graphHref} className={secondaryLinkClass}>
              {copy.openInGraph}
            </Link>
          </SearchResultItem>
        );
      })}
    </SearchResultList>
  );
}

export function KbSearchEntityList({
  kbId,
  hits,
  copy,
}: {
  kbId: string;
  hits: LedgerEntityHit[];
  copy: KbSearchCopy;
}) {
  if (hits.length === 0) {
    return <EmptyState title={copy.noResults} />;
  }
  return (
    <SearchResultList>
      {hits.map((hit) => {
        const entityId = ledgerEntityId(hit);
        const labels: Record<string, string | null> = {
          [entityId]: hit.canonical_label,
        };
        const { title, subtitle } = formatNodeRefDetail(entityId, labels);
        const graphHref = kbGraphPath(kbId, { focus: entityId });
        return (
          <SearchResultItem key={entityId}>
            <Link to={graphHref} className={titleLinkClass}>
              {title}
            </Link>
            {subtitle || hit.entity_kind ? (
              <p className={metaLineClass}>
                {subtitle ?? null}
                {subtitle && hit.entity_kind ? ' · ' : null}
                {hit.entity_kind ?? null}
              </p>
            ) : null}
            {hit.description ? <p className={snippetClass}>{hit.description}</p> : null}
            <Link to={graphHref} className={secondaryLinkClass}>
              {copy.openInGraph}
            </Link>
          </SearchResultItem>
        );
      })}
    </SearchResultList>
  );
}
