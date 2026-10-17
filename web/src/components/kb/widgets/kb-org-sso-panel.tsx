import { type FormEvent, useCallback, useEffect, useMemo, useState } from 'react';
import { toast } from 'sonner';
import { Button } from '@/components/ui/button.js';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card.js';
import { Input } from '@/components/ui/input.js';
import { Label } from '@/components/ui/label.js';
import { Spinner } from '@/components/ui/spinner.js';
import { Switch } from '@/components/ui/switch.js';
import { useI18n } from '@/i18n/context.js';
import type { Locale } from '@/i18n/locale.js';
import { api } from '@/lib/api.js';
import { formatUserFacingApiError } from '@/lib/api-error-message.js';
import { orgSsoPublicUrls } from '@/lib/auth-site-url.js';

type OrgPublic = { id: string; name: string; slug: string };

type OrgOidcResponse = {
  configured: boolean;
  can_edit?: boolean;
  organization: OrgPublic;
  login_url: string;
  callback_url: string;
  issuer?: string;
  client_id?: string;
  scopes?: string;
  email_domains?: string[];
  enabled?: boolean;
};

export function OrgSsoPanel({
  organizationId,
  siteBaseUrl,
}: {
  organizationId: string | null | undefined;
  /** When set (e.g. from platform login settings), login/callback URLs track this base. */
  siteBaseUrl?: string;
}) {
  const { t, locale } = useI18n();
  const copy = t.kbOrgSso;
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [data, setData] = useState<OrgOidcResponse | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [issuer, setIssuer] = useState('');
  const [clientId, setClientId] = useState('');
  const [clientSecret, setClientSecret] = useState('');
  const [scopes, setScopes] = useState('openid email profile');
  const [emailDomains, setEmailDomains] = useState('');
  const [enabled, setEnabled] = useState(true);

  const refresh = useCallback(async () => {
    if (!organizationId) {
      setData(null);
      setLoading(false);
      return;
    }
    setLoading(true);
    setError(null);
    try {
      const body = await api<OrgOidcResponse>(`/api/orgs/${organizationId}/oidc`);
      setData(body);
      if (body.configured) {
        setIssuer(body.issuer ?? '');
        setClientId(body.client_id ?? '');
        setScopes(body.scopes ?? 'openid email profile');
        setEmailDomains((body.email_domains ?? []).join(', '));
        setEnabled(body.enabled ?? true);
      }
      setClientSecret('');
    } catch (err) {
      setError(formatUserFacingApiError(err, locale as Locale));
      setData(null);
    } finally {
      setLoading(false);
    }
  }, [organizationId, locale]);

  useEffect(() => {
    void refresh();
  }, [refresh]);

  async function save(event: FormEvent) {
    event.preventDefault();
    if (!organizationId || !data?.can_edit) return;
    setSaving(true);
    setError(null);
    const domains = emailDomains
      .split(',')
      .map((d) => d.trim())
      .filter(Boolean);
    try {
      await api(`/api/orgs/${organizationId}/oidc`, {
        method: 'PUT',
        body: JSON.stringify({
          issuer,
          client_id: clientId,
          client_secret: clientSecret,
          scopes,
          email_domains: domains,
          enabled,
        }),
      });
      toast.success(copy.saved);
      await refresh();
    } catch (err) {
      setError(formatUserFacingApiError(err, locale as Locale));
    } finally {
      setSaving(false);
    }
  }

  function copyText(text: string) {
    void navigator.clipboard.writeText(text).then(() => {
      toast.success(copy.copied);
    });
  }

  const publicUrls = useMemo(() => {
    const base = siteBaseUrl?.trim();
    const slug = data?.organization.slug;
    if (!base || !slug) return null;
    return orgSsoPublicUrls(base, slug);
  }, [data?.organization.slug, siteBaseUrl]);

  const loginUrl = publicUrls?.login_url ?? data?.login_url ?? '';
  const callbackUrl = publicUrls?.callback_url ?? data?.callback_url ?? '';

  if (!organizationId) {
    return (
      <Card>
        <CardHeader>
          <CardTitle className="text-base">{copy.title}</CardTitle>
          <CardDescription>{copy.noOrganization}</CardDescription>
        </CardHeader>
      </Card>
    );
  }

  if (loading) {
    return (
      <Card>
        <CardHeader>
          <CardTitle className="text-base">{copy.title}</CardTitle>
        </CardHeader>
        <CardContent className="flex items-center gap-2 text-sm text-muted-foreground">
          <Spinner className="size-4" />
          {t.common.loading}
        </CardContent>
      </Card>
    );
  }

  if (!data) {
    return (
      <Card>
        <CardHeader>
          <CardTitle className="text-base">{copy.title}</CardTitle>
          <CardDescription>{copy.loadFailed}</CardDescription>
        </CardHeader>
        {error ? <CardContent className="text-sm text-destructive">{error}</CardContent> : null}
      </Card>
    );
  }

  const canEdit = data.can_edit === true;
  const readOnly = !canEdit;

  return (
    <Card>
      <CardHeader>
        <CardTitle className="text-base">{copy.title}</CardTitle>
        <CardDescription>{copy.description}</CardDescription>
      </CardHeader>
      <CardContent className="space-y-6">
        {error ? <p className="text-sm text-destructive">{error}</p> : null}

        <dl className="grid gap-2 text-sm sm:grid-cols-[minmax(8rem,auto)_1fr]">
          <dt className="text-muted-foreground">{copy.orgLabel}</dt>
          <dd>{data.organization.name}</dd>
          <dt className="text-muted-foreground">{copy.slugLabel}</dt>
          <dd className="font-mono text-xs">{data.organization.slug}</dd>
          <dt className="text-muted-foreground">{copy.loginUrlLabel}</dt>
          <dd className="flex flex-wrap items-center gap-2">
            <code className="break-all text-xs">{loginUrl}</code>
            <Button type="button" size="sm" variant="outline" onClick={() => copyText(loginUrl)}>
              {t.common.copy}
            </Button>
          </dd>
          <dt className="text-muted-foreground">{copy.callbackHint}</dt>
          <dd className="flex flex-wrap items-center gap-2">
            <code className="break-all text-xs">{callbackUrl}</code>
            <Button type="button" size="sm" variant="outline" onClick={() => copyText(callbackUrl)}>
              {t.common.copy}
            </Button>
          </dd>
        </dl>
        <p className="text-sm text-muted-foreground">
          {data.configured ? copy.configured : copy.notConfigured}
        </p>

        {readOnly ? (
          <p className="text-sm text-muted-foreground">{copy.forbidden}</p>
        ) : (
          <form className="space-y-4" onSubmit={save}>
            <div className="space-y-2">
              <Label htmlFor="sso-issuer">{copy.fields.issuer}</Label>
              <Input
                id="sso-issuer"
                value={issuer}
                onChange={(e) => setIssuer(e.target.value)}
                placeholder={copy.issuerPlaceholder}
                required
              />
            </div>
            <div className="space-y-2">
              <Label htmlFor="sso-client-id">{copy.fields.clientId}</Label>
              <Input
                id="sso-client-id"
                value={clientId}
                onChange={(e) => setClientId(e.target.value)}
                placeholder={copy.clientIdPlaceholder}
                required
              />
            </div>
            <div className="space-y-2">
              <Label htmlFor="sso-client-secret">{copy.fields.clientSecret}</Label>
              <Input
                id="sso-client-secret"
                type="password"
                autoComplete="off"
                value={clientSecret}
                onChange={(e) => setClientSecret(e.target.value)}
                placeholder={copy.clientSecretPlaceholder}
                required={!data.configured}
              />
              {data.configured ? (
                <p className="text-xs text-muted-foreground">{copy.clientSecretKeepHint}</p>
              ) : null}
            </div>
            <div className="space-y-2">
              <Label htmlFor="sso-scopes">{copy.fields.scopes}</Label>
              <Input
                id="sso-scopes"
                value={scopes}
                onChange={(e) => setScopes(e.target.value)}
                placeholder={copy.scopesPlaceholder}
              />
            </div>
            <div className="space-y-2">
              <Label htmlFor="sso-domains">{copy.fields.emailDomains}</Label>
              <Input
                id="sso-domains"
                value={emailDomains}
                onChange={(e) => setEmailDomains(e.target.value)}
                placeholder="acme.com, acme.cn"
              />
              <p className="text-xs text-muted-foreground">{copy.emailDomainsHint}</p>
            </div>
            <div className="flex items-center gap-3">
              <Switch id="sso-enabled" checked={enabled} onCheckedChange={setEnabled} />
              <Label htmlFor="sso-enabled">{copy.fields.enabled}</Label>
            </div>
            <Button type="submit" disabled={saving}>
              {saving ? copy.saving : copy.save}
            </Button>
          </form>
        )}
      </CardContent>
    </Card>
  );
}
