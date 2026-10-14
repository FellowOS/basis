import { kbPath } from '@/lib/nav-config.js';

export type ChatCitationLink = {
  kind: 'graph' | 'chunk' | 'entity';
  id: string;
  label?: string;
};

type ToolTrace = {
  name: string;
  arguments: Record<string, unknown>;
  result: string;
};

function addUnique(links: ChatCitationLink[], seen: Set<string>, link: ChatCitationLink) {
  const key = `${link.kind}:${link.id}`;
  if (!link.id.trim() || seen.has(key)) return;
  seen.add(key);
  links.push(link);
}

function parseJsonSafe(text: string): unknown {
  try {
    return JSON.parse(text) as unknown;
  } catch {
    return null;
  }
}

function collectFromPayload(
  links: ChatCitationLink[],
  seen: Set<string>,
  payload: unknown,
  depth = 0,
): void {
  if (depth > 6 || payload == null) return;
  if (typeof payload === 'string') {
    if (payload.length < 128 && !payload.includes('\n')) {
      addUnique(links, seen, { kind: 'graph', id: payload });
    }
    return;
  }
  if (Array.isArray(payload)) {
    for (const item of payload) collectFromPayload(links, seen, item, depth + 1);
    return;
  }
  if (typeof payload !== 'object') return;
  const record = payload as Record<string, unknown>;

  if (typeof record.id === 'string') {
    const kind =
      typeof record.chunk_id === 'string' || record.text != null
        ? 'chunk'
        : typeof record.entity_id === 'string'
          ? 'entity'
          : 'graph';
    addUnique(links, seen, {
      kind: kind === 'chunk' ? 'chunk' : kind === 'entity' ? 'entity' : 'graph',
      id: record.id,
      label: typeof record.label === 'string' ? record.label : undefined,
    });
  }
  if (typeof record.node_id === 'string') {
    addUnique(links, seen, { kind: 'graph', id: record.node_id });
  }
  if (typeof record.entity_id === 'string') {
    addUnique(links, seen, { kind: 'entity', id: record.entity_id });
  }
  if (typeof record.chunk_id === 'string') {
    addUnique(links, seen, { kind: 'chunk', id: record.chunk_id });
  }
  if (Array.isArray(record.graph_nodes)) {
    for (const node of record.graph_nodes) {
      if (node && typeof node === 'object' && typeof (node as { id?: string }).id === 'string') {
        addUnique(links, seen, {
          kind: 'graph',
          id: (node as { id: string }).id,
          label: typeof (node as { label?: string }).label === 'string'
            ? (node as { label: string }).label
            : undefined,
        });
      }
    }
  }
  if (Array.isArray(record.ledger_entities)) {
    for (const entity of record.ledger_entities) {
      if (entity && typeof entity === 'object') {
        const row = entity as { entity_id?: string; id?: string; label?: string };
        const id = row.entity_id ?? row.id;
        if (typeof id === 'string') {
          addUnique(links, seen, {
            kind: 'entity',
            id,
            label: typeof row.label === 'string' ? row.label : undefined,
          });
        }
      }
    }
  }
  if (Array.isArray(record.path)) {
    for (const step of record.path) {
      if (typeof step === 'string') addUnique(links, seen, { kind: 'graph', id: step });
    }
  }
  if (Array.isArray(record.chunks)) {
    for (const chunk of record.chunks) {
      if (chunk && typeof chunk === 'object' && typeof (chunk as { chunk_id?: string }).chunk_id === 'string') {
        addUnique(links, seen, { kind: 'chunk', id: (chunk as { chunk_id: string }).chunk_id });
      }
    }
  }

  for (const value of Object.values(record)) {
    if (value && (typeof value === 'object' || Array.isArray(value))) {
      collectFromPayload(links, seen, value, depth + 1);
    }
  }
}

/** Extract KB deep-link targets from MCP tool traces returned by the chat playground. */
export function extractChatCitationLinks(traces: ToolTrace[]): ChatCitationLink[] {
  const links: ChatCitationLink[] = [];
  const seen = new Set<string>();

  for (const trace of traces) {
    const args = trace.arguments ?? {};
    if (trace.name === 'neighbors' && typeof args.node_id === 'string') {
      addUnique(links, seen, { kind: 'graph', id: args.node_id });
    }
    if (trace.name === 'paths') {
      if (typeof args.source === 'string') addUnique(links, seen, { kind: 'graph', id: args.source });
      if (typeof args.target === 'string') addUnique(links, seen, { kind: 'graph', id: args.target });
    }
    if (trace.name === 'entity_facts' && typeof args.entity_id === 'string') {
      addUnique(links, seen, { kind: 'entity', id: args.entity_id });
    }
    if (trace.name === 'get_chunk' && typeof args.chunk_id === 'string') {
      addUnique(links, seen, { kind: 'chunk', id: args.chunk_id });
    }

    const parsed = parseJsonSafe(trace.result);
    if (parsed) collectFromPayload(links, seen, parsed);
  }

  return links.slice(0, 12);
}

export function chatCitationHref(kbId: string, link: ChatCitationLink): string {
  if (link.kind === 'chunk') {
    return `${kbPath(kbId, 'sources')}?chunk=${encodeURIComponent(link.id)}`;
  }
  return `${kbPath(kbId, 'graph')}?focus=${encodeURIComponent(link.id)}`;
}
