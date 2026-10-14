import { useEffect, useMemo, useState } from 'react';
import { Link, useSearchParams } from 'react-router-dom';
import { EntityRefLine } from '@/components/entity-ref-line.js';
import { Button } from '@/components/ui/button.js';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card.js';
import { useI18n } from '@/i18n/context.js';
import { api } from '@/lib/api.js';
import { useKbNodeLabels } from '@/lib/kb-node-labels.js';
import { kbPath } from '@/lib/nav-config.js';

type ChunkSummary = { id: string; ordinal: number; text: string };

type ChunkDetail = {
  chunk_id: string;
  document_id: string;
  document_title: string;
  ordinal: number;
  text: string;
};

type ChunkStatement = {
  statement_id: string;
  surface_phrase: string;
  subject_id: string;
  object_entity_id: string | null;
  object_value: string | null;
  status: string;
  quote: string | null;
};

export function LedgerEvidenceInspector({ kbId }: { kbId: string }) {
  const { locale } = useI18n();
  const [searchParams, setSearchParams] = useSearchParams();
  const docRef = searchParams.get('doc')?.trim() || null;
  const chunkId = searchParams.get('chunk')?.trim() || null;

  const [docTitle, setDocTitle] = useState<string | null>(null);
  const [docChunks, setDocChunks] = useState<ChunkSummary[]>([]);
  const [chunk, setChunk] = useState<ChunkDetail | null>(null);
  const [statements, setStatements] = useState<ChunkStatement[]>([]);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const labelIds = useMemo(() => {
    const ids: string[] = [];
    for (const row of statements) {
      ids.push(row.subject_id);
      if (row.object_entity_id) ids.push(row.object_entity_id);
    }
    return ids;
  }, [statements]);
  const labels = useKbNodeLabels(kbId, labelIds);

  useEffect(() => {
    if (!docRef || chunkId) {
      setDocChunks([]);
      setDocTitle(null);
      return;
    }
    let cancelled = false;
    setLoading(true);
    setError(null);
    void api<{ document: { title?: string; doc_id?: string } }>(
      `/api/kbs/${kbId}/ledger/documents/${encodeURIComponent(docRef)}`,
    )
      .then((meta) => {
        if (!cancelled) {
          setDocTitle(meta.document?.title ?? meta.document?.doc_id ?? docRef);
        }
      })
      .catch(() => {
        if (!cancelled) setDocTitle(docRef);
      });
    void api<{ chunks: ChunkSummary[] }>(
      `/api/kbs/${kbId}/ledger/documents/${encodeURIComponent(docRef)}/chunks`,
    )
      .then((data) => {
        if (!cancelled) setDocChunks(data.chunks ?? []);
      })
      .catch((err) => {
        if (!cancelled) {
          setError(err instanceof Error ? err.message : 'Failed to load');
          setDocChunks([]);
        }
      })
      .finally(() => {
        if (!cancelled) setLoading(false);
      });
    return () => {
      cancelled = true;
    };
  }, [kbId, docRef, chunkId]);

  useEffect(() => {
    if (!chunkId) {
      setChunk(null);
      setStatements([]);
      return;
    }
    let cancelled = false;
    setLoading(true);
    setError(null);
    void api<{ chunk: ChunkDetail; statements: ChunkStatement[] }>(
      `/api/kbs/${kbId}/ledger/chunks/${encodeURIComponent(chunkId)}`,
    )
      .then((data) => {
        if (!cancelled) {
          setChunk(data.chunk);
          setStatements(data.statements ?? []);
        }
      })
      .catch((err) => {
        if (!cancelled) {
          setError(err instanceof Error ? err.message : 'Failed to load');
          setChunk(null);
          setStatements([]);
        }
      })
      .finally(() => {
        if (!cancelled) setLoading(false);
      });
    return () => {
      cancelled = true;
    };
  }, [kbId, chunkId]);

  function clearEvidenceParams() {
    const next = new URLSearchParams(searchParams);
    next.delete('doc');
    next.delete('chunk');
    setSearchParams(next, { replace: true });
  }

  function openChunk(id: string) {
    const next = new URLSearchParams(searchParams);
    next.set('chunk', id);
    next.delete('doc');
    setSearchParams(next, { replace: true });
  }

  if (!docRef && !chunkId) return null;

  const graphFocusId =
    statements.find((row) => row.subject_id)?.subject_id ??
    statements.find((row) => row.object_entity_id)?.object_entity_id ??
    null;

  const title =
    chunkId
      ? locale === 'zh'
        ? '片段证据'
        : 'Chunk evidence'
      : locale === 'zh'
        ? `文档：${docTitle ?? docRef}`
        : `Document: ${docTitle ?? docRef}`;
  const closeLabel = locale === 'zh' ? '关闭' : 'Close';
  const openChunkLabel = locale === 'zh' ? '查看片段' : 'View chunk';
  const statementsTitle = locale === 'zh' ? '本片段陈述' : 'Statements in chunk';
  const noStatements = locale === 'zh' ? '无关联陈述' : 'No linked statements';
  const loadingLabel = locale === 'zh' ? '加载中…' : 'Loading…';

  return (
    <Card className="m-4 border-primary/30">
      <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
        <CardTitle className="text-base">{title}</CardTitle>
        <Button type="button" variant="ghost" size="sm" onClick={clearEvidenceParams}>
          {closeLabel}
        </Button>
      </CardHeader>
      <CardContent className="space-y-4 text-sm">
        {error ? <p className="text-destructive">{error}</p> : null}
        {loading && !chunk && docChunks.length === 0 ? (
          <p className="text-muted-foreground">{loadingLabel}</p>
        ) : null}

        {docRef && !chunkId ? (
          <ul className="space-y-2">
            {docChunks.length === 0 && !loading ? (
              <li className="text-muted-foreground">
                {locale === 'zh' ? '暂无片段' : 'No chunks'}
              </li>
            ) : (
              docChunks.map((row) => (
                <li key={row.id} className="rounded-md border p-3">
                  <div className="flex items-start justify-between gap-2">
                    <span className="text-xs text-muted-foreground">#{row.ordinal}</span>
                    <Button type="button" size="sm" variant="outline" onClick={() => openChunk(row.id)}>
                      {openChunkLabel}
                    </Button>
                  </div>
                  <p className="mt-2 line-clamp-4 whitespace-pre-wrap">{row.text}</p>
                </li>
              ))
            )}
          </ul>
        ) : null}

        {chunk ? (
          <>
            <div className="text-xs text-muted-foreground">
              {chunk.document_title || chunk.document_id} · #{chunk.ordinal}
            </div>
            <pre className="max-h-64 overflow-auto rounded-md bg-muted p-3 text-xs whitespace-pre-wrap">
              {chunk.text}
            </pre>
            <div>
              <div className="mb-2 font-medium">{statementsTitle}</div>
              {statements.length === 0 ? (
                <p className="text-muted-foreground">{noStatements}</p>
              ) : (
                <ul className="space-y-2 text-xs">
                  {statements.map((row) => (
                    <li key={row.statement_id} className="rounded border p-2">
                      <EntityRefLine id={row.subject_id} labels={labels} />
                      <div className="mt-1">
                        <span className="font-medium">{row.surface_phrase}</span>
                        {' → '}
                        {row.object_entity_id ? (
                          <EntityRefLine id={row.object_entity_id} labels={labels} className="inline" />
                        ) : (
                          <span className="text-muted-foreground">{row.object_value}</span>
                        )}
                        <span className="ml-2 text-muted-foreground">({row.status})</span>
                      </div>
                      {row.quote ? (
                        <blockquote className="mt-1 border-l-2 pl-2 text-muted-foreground">
                          {row.quote}
                        </blockquote>
                      ) : null}
                    </li>
                  ))}
                </ul>
              )}
            </div>
            {graphFocusId ? (
              <Button variant="link" size="sm" className="h-auto p-0" asChild>
                <Link to={`${kbPath(kbId, 'graph')}?focus=${encodeURIComponent(graphFocusId)}`}>
                  {locale === 'zh' ? '在图谱中定位实体' : 'Focus entity in graph'}
                </Link>
              </Button>
            ) : null}
          </>
        ) : null}
      </CardContent>
    </Card>
  );
}
