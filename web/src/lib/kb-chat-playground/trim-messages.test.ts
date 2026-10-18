import { describe, expect, it } from 'vitest';
import {
  PLAYGROUND_MAX_MESSAGES,
  trimPlaygroundMessages,
} from '@/lib/kb-chat-playground/trim-messages.js';

describe('trimPlaygroundMessages', () => {
  it('drops oldest turns when over max count', () => {
    const messages = Array.from({ length: PLAYGROUND_MAX_MESSAGES + 5 }, (_, i) => ({
      role: 'user',
      content: `msg-${i}`,
    }));
    const { messages: trimmed, removedTurns } = trimPlaygroundMessages(messages);
    expect(trimmed.length).toBeLessThanOrEqual(PLAYGROUND_MAX_MESSAGES);
    expect(trimmed[0]?.content).toBe('msg-5');
    expect(trimmed.at(-1)?.content).toBe(`msg-${PLAYGROUND_MAX_MESSAGES + 4}`);
    expect(removedTurns).toBe(5);
  });

  it('reports no trim when under limits', () => {
    const messages = [{ role: 'user', content: 'hi' }];
    const { messages: trimmed, removedTurns } = trimPlaygroundMessages(messages);
    expect(trimmed).toEqual(messages);
    expect(removedTurns).toBe(0);
  });
});
