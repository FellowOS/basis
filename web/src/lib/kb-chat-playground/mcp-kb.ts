import { basisSessionFetch } from '@/lib/basis-session-fetch.js';
import { kbApiPath } from '@/lib/kb-api-path.js';

export type McpToolDefinition = {
  name: string;
  description?: string;
  inputSchema: Record<string, unknown>;
};

type JsonRpcResponse = {
  result?: {
    tools?: McpToolDefinition[];
    content?: Array<{ type?: string; text?: string }>;
    isError?: boolean;
  };
  error?: { message?: string };
};

let rpcId = 0;

async function mcpRequest(kbId: string, body: Record<string, unknown>): Promise<JsonRpcResponse> {
  const response = await basisSessionFetch(kbApiPath(kbId, 'mcp'), {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify(body),
  });
  const data = (await response.json().catch(() => ({}))) as JsonRpcResponse & {
    detail?: { message?: string; code?: string };
  };
  if (!response.ok) {
    throw data;
  }
  if (data.error?.message) {
    throw new Error(data.error.message);
  }
  return data;
}

export async function listKbMcpTools(kbId: string): Promise<McpToolDefinition[]> {
  const data = await mcpRequest(kbId, {
    jsonrpc: '2.0',
    id: ++rpcId,
    method: 'tools/list',
    params: {},
  });
  return data.result?.tools ?? [];
}

export async function callKbMcpTool(
  kbId: string,
  name: string,
  args: Record<string, unknown>,
): Promise<string> {
  const data = await mcpRequest(kbId, {
    jsonrpc: '2.0',
    id: ++rpcId,
    method: 'tools/call',
    params: { name, arguments: args },
  });
  const result = data.result;
  if (result?.isError) {
    const text = result.content?.[0]?.text ?? 'MCP tool error';
    throw new Error(text);
  }
  const content = result?.content;
  if (content?.[0]?.text) {
    return content[0].text;
  }
  return JSON.stringify(result ?? {});
}

export function mcpToolsToOpenAiFunctions(tools: McpToolDefinition[]) {
  return tools.map((tool) => ({
    type: 'function' as const,
    function: {
      name: tool.name,
      description: tool.description ?? '',
      parameters: tool.inputSchema,
    },
  }));
}
