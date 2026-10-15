export const chat = {
  tabPlayground: 'Playground',
  tabConnect: 'Connect MCP',
  playgroundTitle: 'Knowledge chat',
  playgroundHint: 'Uses the same MCP tools as external clients (configure Chat model in Models).',
  playgroundEmpty: 'Ask about this knowledge base, e.g. “What documents mention …?”',
  inputPlaceholder: 'Ask a question — Enter to send, Shift+Enter for newline',
  send: 'Send',
  stop: 'Stop',
  sendFailed: 'Failed to send',
  cancelled: 'Generation stopped.',
  contextTrimmed:
    'Older messages were dropped from this request ({count} turns) to stay within server limits.',
  proposeRemember: 'Propose for review',
  rememberQueued: 'Submitted to the review queue.',
  emptyReply: '(No text reply)',
} as const;
