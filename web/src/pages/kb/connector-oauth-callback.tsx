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
  kbConnectorOAuthRedirectUri,
  readPendingConnectorOAuth,
} from '@/lib/kb-connector-oauth.js';
import { kbConnectorPanelPath } from '@/lib/nav-config.js';
import { kbOpenApiPOST } from '@/lib/openapi-client.js';

type CallbackPhase = 'working' | 'success' | 'error';

export function KbConnectorOAuthCallbackPage() {
  const { id: kbId } = useParams();
  const [searchParams] = useSearchParams();
  const navigate = useNavigate();
  const { t, locale } = useI18n();
  const c = t.kbConnectors.catalog;
  const [phase, setPhase] = useState<CallbackPhase>('working');
  const [errorMessage, setErrorMessage] = useState<string | null>(null);

  useEffect(() => {
    if (!kbId) {
      setPhase('error');
      setErrorMessage(c.oauthCallbackMissing);
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
      setErrorMessage(c.oauthCallbackMissing);
      return;
    }

    const pending = readPendingConnectorOAuth();
    if (!pending || pending.kbId !== kbId || pending.state !== state) {
      setPhase('error');
      setErrorMessage(c.oauthCallbackStateMismatch);
      return;
    }

    void (async () => {
      try {
        await kbOpenApiPOST(kbId, `connectors/oauth/${pending.service}/exchange`, {
          body: {
            code,
            redirect_uri: pending.redirectUri || kbConnectorOAuthRedirectUri(kbId),
            code_verifier: pending.codeVerifier ?? null,
            connection_name: pending.connectionName,
            connection_config: pending.connectionConfig,
          },
        });
        clearPendingConnectorOAuth();
        setPhase('success');
        toast.success(c.oauthCallbackSuccess);
        navigate(kbConnectorPanelPath(kbId, 'catalog'), { replace: true });
      } catch (err) {
        clearPendingConnectorOAuth();
        setPhase('error');
        setErrorMessage(formatUserFacingApiError(err, locale as Locale));
      }
    })();
  }, [c, kbId, locale, navigate, searchParams]);

  if (!kbId) {
    return null;
  }

  const crumbs = [
    { label: t.menu.platform.kbs, to: '/kbs' },
    { label: t.menu.kbZones.connectors, to: kbConnectorPanelPath(kbId, 'catalog') },
    { label: c.oauthCallbackTitle },
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
            <p className="text-sm text-muted-foreground">{c.oauthCallbackWorking}</p>
          </>
        ) : null}
        {phase === 'error' ? (
          <>
            <p className="text-sm text-destructive">{errorMessage ?? c.oauthCallbackFailed}</p>
            <Link
              className="text-sm text-primary hover:underline"
              to={kbConnectorPanelPath(kbId, 'catalog')}
            >
              {c.oauthBackToCatalog}
            </Link>
          </>
        ) : null}
        {phase === 'success' ? (
          <p className="text-sm text-muted-foreground">{c.oauthCallbackSuccess}</p>
        ) : null}
      </div>
    </ConsolePageLayout>
  );
}
