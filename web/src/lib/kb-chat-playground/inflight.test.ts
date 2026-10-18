import { describe, expect, it } from 'vitest';

import { playgroundEnter, playgroundExit } from '@/lib/kb-chat-playground/inflight.js';

describe('playground inflight guard', () => {
  it('blocks overlapping runs for the same kb', () => {
    playgroundEnter('kb-a');
    try {
      expect(() => playgroundEnter('kb-a')).toThrowError(/chat_in_flight/);
      let caught: unknown;
      try {
        playgroundEnter('kb-a');
      } catch (err) {
        caught = err;
      }
      expect(caught).toBeInstanceOf(Error);
      expect((caught as Error & { code?: string }).code).toBe('chat_in_flight');
    } finally {
      playgroundExit('kb-a');
    }
    expect(() => playgroundEnter('kb-a')).not.toThrow();
    playgroundExit('kb-a');
  });

  it('isolates keys per knowledge base', () => {
    playgroundEnter('kb-1');
    expect(() => playgroundEnter('kb-2')).not.toThrow();
    playgroundExit('kb-2');
    playgroundExit('kb-1');
  });
});
