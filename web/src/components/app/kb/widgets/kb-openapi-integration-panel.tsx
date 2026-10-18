import { useMemo } from 'react';
import { Link } from 'react-router-dom';
import SwaggerUI from 'swagger-ui-react';
import 'swagger-ui-react/swagger-ui.css';
import { Button } from '@/components/ui/button.js';
import { useI18n } from '@/i18n/context.js';
import { basisApiBaseUrl } from '@/lib/basis-api-url.js';
import { getToken } from '@/lib/auth-token.js';
import { kbApiRoot } from '@/lib/kb-api-path.js';
import { openapiSpecUrl } from '@/lib/openapi-spec-url.js';

type KbOpenApiIntegrationPanelProps = {
  kbId: string;
};

export function KbOpenApiIntegrationPanel({ kbId }: KbOpenApiIntegrationPanelProps) {
  const { t } = useI18n();
  const copy = t.menu.kbIntegration.openapi;
  const specUrl = useMemo(() => openapiSpecUrl('kb'), []);
  const apiBase = useMemo(() => {
    const origin = basisApiBaseUrl().replace(/\/$/, '');
    return `${origin}${kbApiRoot(kbId)}`;
  }, [kbId]);

  const requestInterceptor = useMemo(
    () => (req: { headers?: Record<string, string> }) => {
      const token = getToken();
      if (token) {
        req.headers = { ...req.headers, Authorization: `Bearer ${token}` };
      }
      return req;
    },
    [],
  );

  return (
    <div className="flex min-h-0 flex-1 flex-col overflow-hidden rounded-lg border border-border">
      <div className="flex shrink-0 flex-col gap-2 border-b border-border px-4 py-3 sm:flex-row sm:items-center sm:justify-between">
        <p className="text-sm text-muted-foreground">{copy.hint}</p>
        <div className="flex flex-wrap items-center gap-2">
          <Button variant="outline" size="sm" asChild>
            <a href={specUrl} target="_blank" rel="noreferrer">
              {copy.downloadJson}
            </a>
          </Button>
          <Button variant="outline" size="sm" asChild>
            <Link to="/swagger">{copy.openSwagger}</Link>
          </Button>
        </div>
      </div>
      <div className="shrink-0 space-y-1 border-b border-border px-4 py-2 text-xs text-muted-foreground">
        <p>
          {copy.apiBaseLabel}{' '}
          <code className="rounded bg-muted px-1 py-0.5 font-mono text-[11px] text-foreground">
            {apiBase}
          </code>
        </p>
        <p>{copy.kbIdTryItOut}</p>
        <p data-testid="kb-integration-export-ui-hint">
          {copy.exportUiHint}{' '}
          <Link to={`/kbs/${kbId}/settings?tab=graph`} className="text-primary hover:underline">
            {copy.exportUiLink}
          </Link>
        </p>
      </div>
      <div className="basis-swagger-panel min-h-0 flex-1 overflow-auto">
        <SwaggerUI
          key={specUrl}
          url={specUrl}
          docExpansion="list"
          defaultModelsExpandDepth={-1}
          tryItOutEnabled
          requestInterceptor={requestInterceptor}
        />
      </div>
    </div>
  );
}
