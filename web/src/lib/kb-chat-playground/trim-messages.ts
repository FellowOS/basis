export const PLAYGROUND_MAX_MESSAGE_CHARS = 96_000;
export const PLAYGROUND_MAX_MESSAGES = 40;

export type PlaygroundTurn = { role: string; content: string };

export function trimPlaygroundMessages(
  messages: PlaygroundTurn[],
): { messages: PlaygroundTurn[]; removedTurns: number } {
  if (!messages.length) {
    return { messages, removedTurns: 0 };
  }
  let trimmed = messages.filter((m) => m.content);
  let total = trimmed.reduce((n, m) => n + (m.content?.length ?? 0), 0);
  let removedTurns = 0;
  while (
    trimmed.length > 2 &&
    (total > PLAYGROUND_MAX_MESSAGE_CHARS || trimmed.length > PLAYGROUND_MAX_MESSAGES)
  ) {
    const removed = trimmed.shift();
    if (!removed) break;
    total -= removed.content?.length ?? 0;
    removedTurns += 1;
  }
  return { messages: trimmed, removedTurns };
}
