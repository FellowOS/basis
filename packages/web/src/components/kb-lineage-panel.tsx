import { useEffect, useState } from 'react';
import { Link2 } from 'lucide-react';
import { ReactFlow, Background, Controls } from '@xyflow/react';
import '@xyflow/react/dist/style.css';
import { errorFromApiResponse } from '@/lib/api-error.js';
import { useApiErrorMessage } from '@/lib/use-api-error-message.js';
import {
  buildExplorerKbApiPath,
  explorerFetch,
  explorerFetchJson,
} from '@/explorer/host/explorerHttp.js';
import { Button } from '@/components/ui/button.js';
import { Input } from '@/components/ui/input.js';
import { cn } from '@/lib/utils.js';

const THEME_CSS = `
  .kb-lineage-flow .react-flow { background: var(--background); }
  .kb-lineage-flow .react-flow__node-group {
    background: color-mix(in oklab, var(--primary) 6%, transparent);
    border: 1px dashed color-mix(in oklab, var(--primary) 28%, transparent);
    border-radius: 10px;
  }
  .kb-lineage-flow .react-flow__node-default {
    background: var(--card);
    color: var(--card-foreground);
    border: 1px solid var(--border);
    border-radius: 8px;
    padding: 10px 12px;
    white-space: pre-wrap;
    font-size: 12px;
  }
`;

type ProvenancePayload = {
  nodes: Array<{ id: string; parent_id: string; label: string; prov_type: string }>;
  edges: Array<{ id: string; source: string; target: string; label: string }>;
  message?: string;
};

export function KbLineagePanel({
  kbId,
  initialNodeId,
  className,
}: {
  kbId: string;
  initialNodeId?: string | null;
  className?: string;
}) {
  const apiError = useApiErrorMessage();
  const [nodes, setNodes] = useState<any[]>([]);
  const [edges, setEdges] = useState<any[]>([]);
  const [searchId, setSearchId] = useState(initialNodeId ?? '');
  const [activeId, setActiveId] = useState(initialNodeId ?? '');
  const [error, setError] = useState('');

  useEffect(() => {
    if (initialNodeId) {
      setSearchId(initialNodeId);
      setActiveId(initialNodeId);
    }
  }, [initialNodeId]);

  const downloadReport = async (format: 'json' | 'markdown') => {
    if (!activeId) return;
    const response = await explorerFetch(
      buildExplorerKbApiPath(
        `provenance/report?node_id=${encodeURIComponent(activeId)}&format=${format}`,
        kbId,
      ),
    );
    if (!response.ok) {
      const body = await response.json().catch(() => ({}));
      throw errorFromApiResponse(response.status, body, 'Provenance report download failed');
    }
    const blob = await response.blob();
    const url = window.URL.createObjectURL(blob);
    const anchor = document.createElement('a');
    anchor.href = url;
    anchor.download = `${activeId}_provenance.${format === 'markdown' ? 'md' : 'json'}`;
    document.body.appendChild(anchor);
    anchor.click();
    window.URL.revokeObjectURL(url);
    document.body.removeChild(anchor);
  };

  useEffect(() => {
    let ignore = false;
    if (!activeId) {
      setNodes([]);
      setEdges([]);
      return;
    }

    const xLanes = [
      { id: 'group_agent', type: 'group', position: { x: 50, y: 50 }, style: { width: 800, height: 120 } },
      { id: 'group_activity', type: 'group', position: { x: 50, y: 200 }, style: { width: 800, height: 120 } },
      { id: 'group_entity', type: 'group', position: { x: 50, y: 350 }, style: { width: 800, height: 120 } },
    ];

    void (async () => {
      setError('');
      try {
        const data = await explorerFetchJson<ProvenancePayload>(
          buildExplorerKbApiPath(`provenance?node_id=${encodeURIComponent(activeId)}`, kbId),
          undefined,
          'Lineage fetch failed',
        );
        if (data.message) setError(data.message);

        const counters: Record<string, number> = {
          group_agent: 0,
          group_activity: 0,
          group_entity: 0,
        };

        const mappedNodes = data.nodes.map((n) => {
          const c = counters[n.parent_id] ?? 0;
          counters[n.parent_id] = c + 1;
          return {
            id: n.id,
            data: { label: `${n.label}\n(${n.prov_type})` },
            position: { x: 50 + c * 180, y: 30 },
            parentId: n.parent_id,
            extent: 'parent' as const,
            type: 'default',
          };
        });

        const mappedEdges = data.edges.map((e) => ({
          id: e.id,
          source: e.source,
          target: e.target,
          label: e.label,
          animated: true,
          style: { stroke: 'var(--primary)' },
        }));

        if (!ignore) {
          setNodes([...xLanes, ...mappedNodes]);
          setEdges(mappedEdges);
        }
      } catch (err) {
        if (!ignore) setError(apiError(err));
      }
    })();

    return () => {
      ignore = true;
    };
  }, [activeId, apiError, kbId]);

  return (
    <div className={cn('kb-lineage-flow relative flex min-h-0 flex-1 flex-col', className)}>
      <style>{THEME_CSS}</style>
      <div className="flex flex-wrap items-center gap-2 border-b border-border px-3 py-2">
        <span className="text-xs font-semibold uppercase tracking-wide text-muted-foreground">
          PROV-O
        </span>
        <Input
          className="h-8 w-48 font-mono text-xs"
          placeholder="Node ID"
          value={searchId}
          onChange={(e) => setSearchId(e.target.value)}
          onKeyDown={(e) => {
            if (e.key === 'Enter') setActiveId(searchId.trim());
          }}
        />
        <Button type="button" size="sm" onClick={() => setActiveId(searchId.trim())}>
          Trace
        </Button>
        <div className="flex-1" />
        <Button
          type="button"
          size="sm"
          variant="outline"
          disabled={!activeId}
          onClick={() => void downloadReport('json').catch((e) => setError(apiError(e)))}
        >
          JSON
        </Button>
        <Button
          type="button"
          size="sm"
          variant="outline"
          disabled={!activeId}
          onClick={() => void downloadReport('markdown').catch((e) => setError(apiError(e)))}
        >
          Markdown
        </Button>
      </div>

      {error ? (
        <p className="border-b border-border px-3 py-2 text-sm text-destructive">{error}</p>
      ) : null}

      {activeId ? (
        <div className="relative min-h-[420px] flex-1">
          <ReactFlow nodes={nodes} edges={edges} fitView>
            <Background gap={24} />
            <Controls />
          </ReactFlow>
        </div>
      ) : (
        <div className="flex flex-1 flex-col items-center justify-center gap-2 p-8 text-center text-muted-foreground">
          <Link2 className="size-8 opacity-60" />
          <p className="text-sm font-medium text-foreground">PROV-O lineage</p>
          <p className="max-w-sm text-xs">
            Enter a graph node ID and trace W3C PROV-O lineage for this knowledge base.
          </p>
        </div>
      )}
    </div>
  );
}
