import { type FormEvent, useCallback, useEffect, useState } from 'react';
import { toast } from 'sonner';
import { useI18n } from '@/i18n/context.js';
import type { ApiTokenRow, McpIntegrationInfo } from '@/components/kb-mcp-integration-panel.js';
import { api } from '@/lib/api.js';

export function useKbMcpIntegration(kbId: string | undefined, canManageTokens: boolean) {
  const { t } = useI18n();
  const [mcpInfo, setMcpInfo] = useState<McpIntegrationInfo | null>(null);
  const [apiTokens, setApiTokens] = useState<ApiTokenRow[]>([]);
  const [tokenName, setTokenName] = useState('');

  const reloadTokens = useCallback(async () => {
    if (!kbId || !canManageTokens) {
      setApiTokens([]);
      return;
    }
    const listed = await api<{ tokens: ApiTokenRow[] }>(`/api/kbs/${kbId}/tokens`);
    setApiTokens(listed.tokens);
  }, [kbId, canManageTokens]);

  useEffect(() => {
    if (!kbId) return;
    api<McpIntegrationInfo>(`/api/kbs/${kbId}/mcp`)
      .then(setMcpInfo)
      .catch(() => setMcpInfo(null));
    if (canManageTokens) {
      reloadTokens().catch(() => setApiTokens([]));
    }
  }, [kbId, canManageTokens, reloadTokens]);

  const copyToClipboard = useCallback(
    async (text: string) => {
      try {
        await navigator.clipboard.writeText(text);
        toast.success(t.common.copySuccess);
      } catch {
        toast.error(t.menu.kbMcp.copyFailed);
      }
    },
    [t],
  );

  const createApiToken = useCallback(
    async (event: FormEvent) => {
      event.preventDefault();
      if (!kbId || !tokenName.trim()) return;
      try {
        await api(`/api/kbs/${kbId}/tokens`, {
          method: 'POST',
          body: JSON.stringify({ name: tokenName.trim(), scope: 'read' }),
        });
        setTokenName('');
        await reloadTokens();
        toast.success(t.common.updateSuccess);
      } catch (err) {
        toast.error(err instanceof Error ? err.message : t.common.operationFailed);
      }
    },
    [kbId, tokenName, reloadTokens, t],
  );

  const deleteApiToken = useCallback(
    async (tokenId: string) => {
      if (!kbId) return;
      try {
        await api(`/api/kbs/${kbId}/tokens/${tokenId}`, { method: 'DELETE' });
        await reloadTokens();
        toast.success(t.common.deleteSuccess);
      } catch (err) {
        toast.error(err instanceof Error ? err.message : t.common.deleteFailed);
      }
    },
    [kbId, reloadTokens, t],
  );

  return {
    mcpInfo,
    apiTokens,
    tokenName,
    setTokenName,
    copyToClipboard,
    createApiToken,
    deleteApiToken,
  };
}
