import { useEffect, useState } from 'react';
import { Link, useNavigate, useParams, useSearchParams } from 'react-router-dom';
import { toast } from 'sonner';
import { ConsolePageLayout } from '@/components/app/shared/console/index.js';
import { Spinner } from '@/components/ui/spinner.js';
import { useI18n } from '@/i18n/context.js';
import type { Locale } from '@/i18n/locale.js';
import { formatUserFacingApiError } from '@/lib/api-error-message.js';
import {
  clearPendingConnectorOAuth,
  workspaceConnectorOAuthRedirectUri,
  readPendingConnectorOAuth,
} from '@/modules/connectors/lib/connector-oauth.js';
import { workspaceConnectorPanelPath } from '@/lib/nav-config.js';
import { workspaceOpenApiPOST } from '@/lib/openapi-client.js';

type CallbackPhase = 'working' | 'success' | 'error';

export function ConnectorOAuthCallbackPage() {
  const { id: workspaceId } = useParams();
  const [searchParams] = useSearchParams();
  const navigate = useNavigate();
  const { t, locale } = useI18n();
  const c = t.connectors.page.catalog;
  const [phase, setPhase] = useState<CallbackPhase>('working');
  const [errorMessage, setErrorMessage] = useState<string | null>(null);

  useEffect(() => {
    if (!workspaceId) {
      setPhase('error');
      setErrorMessage(c.oauth_callback_missing);
      return;
    }

    const code = searchParams.get('code');
    const state = searchParams.get('state');
    const oauthError = searchParams.get('error');

    if (oauthError) {
      clearPendingConnectorOAuth();
      setPhase('error');
      setErrorMessage(searchParams.get('error_description') ?? oauthError);
      return;
    }

    if (!code || !state) {
      setPhase('error');
      setErrorMessage(c.oauth_callback_missing);
      return;
    }

    const pending = readPendingConnectorOAuth();
    if (!pending || pending.workspaceId !== workspaceId || pending.state !== state) {
      setPhase('error');
      setErrorMessage(c.oauth_callback_state_mismatch);
      return;
    }

    void (async () => {
      try {
        await workspaceOpenApiPOST(workspaceId, `connectors/oauth/${pending.service}/exchange`, {
          body: {
            code,
            redirect_uri: pending.redirectUri || workspaceConnectorOAuthRedirectUri(workspaceId),
            code_verifier: pending.codeVerifier ?? null,
            connection_name: pending.connectionName,
            connection_config: pending.connectionConfig,
          },
        });
        clearPendingConnectorOAuth();
        setPhase('success');
        toast.success(c.oauth_callback_success);
        navigate(workspaceConnectorPanelPath(workspaceId, 'catalog'), { replace: true });
      } catch (err) {
        clearPendingConnectorOAuth();
        setPhase('error');
        setErrorMessage(formatUserFacingApiError(err, locale as Locale));
      }
    })();
  }, [c, workspaceId, locale, navigate, searchParams]);

  if (!workspaceId) {
    return null;
  }

  const crumbs = [
    { label: t.core.workspace_nav.platform.workspaces, to: '/workspaces' },
    { label: t.core.workspace_nav.workspace_zones.connectors, to: workspaceConnectorPanelPath(workspaceId, 'catalog') },
    { label: c.oauth_callback_title },
  ];

  return (
    <ConsolePageLayout crumbs={crumbs}>
      <div
        className="flex min-h-[12rem] flex-col items-center justify-center gap-3 text-center"
        data-testid="connector-oauth-callback"
      >
        {phase === 'working' ? (
          <>
            <Spinner className="size-6" />
            <p className="text-sm text-muted-foreground">{c.oauth_callback_working}</p>
          </>
        ) : null}
        {phase === 'error' ? (
          <>
            <p className="text-sm text-destructive">{errorMessage ?? c.oauth_callback_failed}</p>
            <Link
              className="text-sm text-primary hover:underline"
              to={workspaceConnectorPanelPath(workspaceId, 'catalog')}
            >
              {c.oauth_back_to_catalog}
            </Link>
          </>
        ) : null}
        {phase === 'success' ? (
          <p className="text-sm text-muted-foreground">{c.oauth_callback_success}</p>
        ) : null}
      </div>
    </ConsolePageLayout>
  );
}
