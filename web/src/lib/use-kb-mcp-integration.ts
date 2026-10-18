import { useCallback, useEffect, useState } from 'react';
import { toast } from 'sonner';
import { useI18n } from '@/i18n/context.js';
import type { ApiTokenRow } from '@/components/app/kb/widgets/kb-api-tokens-panel.js';
import type { McpIntegrationInfo } from '@/components/app/kb/widgets/kb-mcp-integration-panel.js';
import { kbApiClient } from '@/lib/kb-api-client.js';
import { kbOpenApiDELETE, kbOpenApiGET, kbOpenApiPOST } from '@/lib/openapi-client.js';
import { useApiErrorMessage } from '@/lib/use-api-error-message.js';

export function useKbMcpIntegration(kbId: string | undefined, canManageTokens: boolean) {
  const { t } = useI18n();
  const apiError = useApiErrorMessage();
  const [mcpInfo, setMcpInfo] = useState<McpIntegrationInfo | null>(null);
  const [apiTokens, setApiTokens] = useState<ApiTokenRow[]>([]);
  const [createdSecret, setCreatedSecret] = useState<string | null>(null);

  const reloadTokens = useCallback(async () => {
    if (!kbId || !canManageTokens) {
      setApiTokens([]);
      return;
    }
    const listed = await kbOpenApiGET<{ tokens: ApiTokenRow[] }>(kbId, 'tokens');
    setApiTokens(listed.tokens);
  }, [kbId, canManageTokens]);

  useEffect(() => {
    if (!kbId) return;
    kbApiClient(kbId)
      .mcpInfo()
      .then((info) => setMcpInfo(info as McpIntegrationInfo))
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
    async (name: string) => {
      const trimmed = name.trim();
      if (!kbId || !trimmed) return;
      try {
        const body = await kbOpenApiPOST<{ secret: string }>(kbId, 'tokens', {
          body: { name: trimmed, scope: 'read' },
        });
        setCreatedSecret(body.secret);
        await reloadTokens();
        toast.success(t.menu.kbMcp.secretOnce);
      } catch (err) {
        toast.error(apiError(err));
        throw err;
      }
    },
    [kbId, reloadTokens, t, apiError],
  );

  const deleteApiToken = useCallback(
    async (tokenId: string) => {
      if (!kbId) return;
      try {
        await kbOpenApiDELETE(kbId, `tokens/${tokenId}`);
        await reloadTokens();
        toast.success(t.common.deleteSuccess);
      } catch (err) {
        toast.error(apiError(err));
      }
    },
    [kbId, reloadTokens, t],
  );

  return {
    mcpInfo,
    apiTokens,
    createdSecret,
    clearCreatedSecret: () => setCreatedSecret(null),
    copyToClipboard,
    createApiToken,
    deleteApiToken,
  };
}
