import type { PlaygroundToolTrace } from '@/lib/kb-chat-playground/stream-playground.js';

/** Parse `review_item_id` from HTTP or MCP `propose_remember` payloads. */
export function parseRememberReviewItemId(payload: unknown): string | undefined {
  if (typeof payload === 'string') {
    const trimmed = payload.trim();
    if (!trimmed) return undefined;
    try {
      return parseRememberReviewItemId(JSON.parse(trimmed) as unknown);
    } catch {
      return undefined;
    }
  }
  if (!payload || typeof payload !== 'object') return undefined;
  const id = (payload as { review_item_id?: unknown }).review_item_id;
  return typeof id === 'string' && id.trim() ? id.trim() : undefined;
}

export function findRememberReviewItemIdInToolTraces(
  traces: PlaygroundToolTrace[],
): string | undefined {
  for (const trace of traces) {
    if (trace.name !== 'propose_remember') continue;
    const fromRaw = parseRememberReviewItemId(trace.result);
    if (fromRaw) return fromRaw;
  }
  return undefined;
}
