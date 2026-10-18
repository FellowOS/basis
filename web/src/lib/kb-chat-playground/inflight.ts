const inflight = new Map<string, number>();

export function playgroundEnter(key: string): void {
  if ((inflight.get(key) ?? 0) > 0) {
    const err = new Error('chat_in_flight');
    (err as Error & { code?: string }).code = 'chat_in_flight';
    throw err;
  }
  inflight.set(key, 1);
}

export function playgroundExit(key: string): void {
  const next = (inflight.get(key) ?? 1) - 1;
  if (next <= 0) {
    inflight.delete(key);
  } else {
    inflight.set(key, next);
  }
}
