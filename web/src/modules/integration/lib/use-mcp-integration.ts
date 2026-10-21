import { useCallback, useEffect, useState } from 'react';
import { toast } from 'sonner';
import { useI18n } from '@/i18n/context.js';
import type { ApiTokenRow } from '@/modules/integration/components/api-tokens-panel.js';
import type { McpIntegrationInfo } from '@/modules/integration/components/mcp-integration-panel.js';
import { workspaceApiClient } from '@/modules/search/lib/api-client.js';
import { workspaceOpenApiDELETE, workspaceOpenApiGET, workspaceOpenApiPOST } from '@/lib/openapi-client.js';
import { useApiErrorMessage } from '@/lib/use-api-error-message.js';

export function useWorkspaceMcpIntegration(workspaceId: string | undefined, canManageTokens: boolean) {
  const { t } = useI18n();
  const apiError = useApiErrorMessage();
  const [mcpInfo, setMcpInfo] = useState<McpIntegrationInfo | null>(null);
  const [apiTokens, setApiTokens] = useState<ApiTokenRow[]>([]);
  const [createdSecret, setCreatedSecret] = useState<string | null>(null);

  const reloadTokens = useCallback(async () => {
    if (!workspaceId || !canManageTokens) {
      setApiTokens([]);
      return;
    }
    const listed = await workspaceOpenApiGET<{ tokens: ApiTokenRow[] }>(workspaceId, 'tokens');
    setApiTokens(listed.tokens);
  }, [workspaceId, canManageTokens]);

  useEffect(() => {
    if (!workspaceId) return;
    workspaceApiClient(workspaceId)
      .mcpInfo()
      .then((info) => setMcpInfo(info as McpIntegrationInfo))
      .catch(() => setMcpInfo(null));
    if (canManageTokens) {
      reloadTokens().catch(() => setApiTokens([]));
    }
  }, [workspaceId, canManageTokens, reloadTokens]);

  const copyToClipboard = useCallback(
    async (text: string) => {
      try {
        await navigator.clipboard.writeText(text);
        toast.success(t.core.common.copySuccess);
      } catch {
        toast.error(t.integration.mcp.copy_failed);
      }
    },
    [t],
  );

  const createApiToken = useCallback(
    async (name: string) => {
      const trimmed = name.trim();
      if (!workspaceId || !trimmed) return;
      try {
        const body = await workspaceOpenApiPOST<{ secret: string }>(workspaceId, 'tokens', {
          body: { name: trimmed, scope: 'read' },
        });
        setCreatedSecret(body.secret);
        await reloadTokens();
        toast.success(t.integration.mcp.secret_once);
      } catch (err) {
        toast.error(apiError(err));
        throw err;
      }
    },
    [workspaceId, reloadTokens, t, apiError],
  );

  const deleteApiToken = useCallback(
    async (tokenId: string) => {
      if (!workspaceId) return;
      try {
        await workspaceOpenApiDELETE(workspaceId, `tokens/${tokenId}`);
        await reloadTokens();
        toast.success(t.core.common.deleteSuccess);
      } catch (err) {
        toast.error(apiError(err));
      }
    },
    [workspaceId, reloadTokens, t],
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
