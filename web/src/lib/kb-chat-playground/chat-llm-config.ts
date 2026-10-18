export type ChatLlmRuntime = {
  model: string;
  base_url: string;
  api_key: string;
};

const STORAGE_KEY = 'basis.console.chatLlmRuntime';

export type StoredChatLlmRuntime = {
  model: string;
  base_url: string;
  api_key: string;
};

/** Playground LLM credentials (this browser only; never sent to Basis). */
export function readStoredChatLlmRuntime(): StoredChatLlmRuntime | null {
  try {
    const raw = localStorage.getItem(STORAGE_KEY);
    if (!raw) return null;
    const parsed = JSON.parse(raw) as StoredChatLlmRuntime;
    if (!parsed?.api_key?.trim() || !parsed?.model?.trim()) return null;
    return {
      model: parsed.model.trim(),
      base_url: (parsed.base_url || '').trim(),
      api_key: parsed.api_key.trim(),
    };
  } catch {
    return null;
  }
}

export function writeStoredChatLlmRuntime(runtime: StoredChatLlmRuntime): void {
  localStorage.setItem(
    STORAGE_KEY,
    JSON.stringify({
      model: runtime.model.trim(),
      base_url: (runtime.base_url || '').trim(),
      api_key: runtime.api_key.trim(),
    }),
  );
}

export function clearStoredChatLlmRuntime(): void {
  localStorage.removeItem(STORAGE_KEY);
}

export function resolveChatLlmRuntime(): ChatLlmRuntime {
  const stored = readStoredChatLlmRuntime();
  if (!stored) {
    throw {
      detail: {
        code: 'chat_not_configured',
        message: 'Configure a chat model in Playground settings (stored in this browser).',
      },
    };
  }
  return {
    model: stored.model,
    base_url: stored.base_url,
    api_key: stored.api_key,
  };
}

export function chatCompletionsUrl(runtime: ChatLlmRuntime): string {
  const root = (runtime.base_url || 'https://api.openai.com/v1').replace(/\/$/, '');
  return root.endsWith('/v1') ? `${root}/chat/completions` : `${root}/v1/chat/completions`;
}

export function chatCompletionsHeaders(runtime: ChatLlmRuntime): Record<string, string> {
  return {
    'Content-Type': 'application/json',
    Authorization: `Bearer ${runtime.api_key}`,
  };
}
