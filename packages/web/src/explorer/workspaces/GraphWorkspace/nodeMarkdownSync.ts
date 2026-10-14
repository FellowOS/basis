import { buildExplorerGraphApiPath, explorerFetch, resolveExplorerApiUrl } from "../../host/explorerHttp";

export interface NodeMarkdownAttributeUpdate {
  label: string;
  content: string;
  properties: Record<string, unknown>;
}

export interface GraphNodeMarkdownSnapshot {
  id: string;
  type: string;
  content: string;
  properties: Record<string, unknown>;
  valid_from: string | null;
  valid_until: string | null;
}

export interface SavedNodeMarkdownAttributeUpdate extends NodeMarkdownAttributeUpdate {
  nodeType: string;
  valid_from: string | null;
  valid_until: string | null;
}

export class NodeMarkdownRefreshGuard {
  private readonly generations = new Map<string, number>();

  begin(nodeId: string): number {
    const generation = (this.generations.get(nodeId) ?? 0) + 1;
    this.generations.set(nodeId, generation);
    return generation;
  }

  invalidate(nodeId: string): void {
    this.begin(nodeId);
  }

  isCurrent(nodeId: string, generation: number): boolean {
    return this.generations.get(nodeId) === generation;
  }
}

export function buildNodeMarkdownAttributeUpdate(
  nodeId: string,
  content: string,
  properties: Record<string, unknown>,
): NodeMarkdownAttributeUpdate {
  return {
    label: content || nodeId,
    content,
    properties: {
      ...properties,
      content,
    },
  };
}

export async function readNodeMarkdownAttributeUpdate(
  nodeId: string,
  kbId?: string,
): Promise<SavedNodeMarkdownAttributeUpdate> {
  const url = kbId
    ? buildExplorerGraphApiPath(`nodes/${encodeURIComponent(nodeId)}`, kbId)
    : resolveExplorerApiUrl(`/api/graph/node?node_id=${encodeURIComponent(nodeId)}`);
  const response = await explorerFetch(url);
  if (!response.ok) {
    throw new Error(`Graph node refresh failed (${response.status}).`);
  }

  const payload = await response.json() as GraphNodeMarkdownSnapshot | { node: GraphNodeMarkdownSnapshot };
  const node = ("node" in payload && payload.node ? payload.node : payload) as GraphNodeMarkdownSnapshot;
  if (node.id !== nodeId) {
    throw new Error("Graph node refresh returned a different resource.");
  }

  return {
    ...buildNodeMarkdownAttributeUpdate(
      node.id,
      node.content,
      node.properties ?? {},
    ),
    nodeType: node.type,
    valid_from: node.valid_from ?? null,
    valid_until: node.valid_until ?? null,
  };
}
