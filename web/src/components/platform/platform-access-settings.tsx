import { type FormEvent, type ReactNode, useCallback, useEffect, useMemo, useState } from 'react';
import { toast } from 'sonner';
import { Button } from '@/components/ui/button.js';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card.js';
import { Input } from '@/components/ui/input.js';
import { Label } from '@/components/ui/label.js';
import { PublicIcon } from '@/components/ui/public-icon.js';
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from '@/components/ui/select.js';
import { Spinner } from '@/components/ui/spinner.js';
import { RadioGroup, RadioGroupItem } from '@/components/ui/radio-group.js';
import { Switch } from '@/components/ui/switch.js';
import { useI18n } from '@/i18n/context.js';
import { api } from '@/lib/api.js';
import { useApiErrorMessage } from '@/lib/use-api-error-message.js';
import { normalizeSiteUrl, platformAuthCallbacks } from '@/lib/auth-site-url.js';
import { cn } from '@/lib/utils.js';

type ProviderId = 'password' | 'email' | 'github' | 'google';

type AccessSettings = {
  auth_providers: string[];
  signup_policy: 'open' | 'closed';
  magic_link_dev_log: boolean;
  public_url: string;
  web_origin: string;
  callbacks: Record<string, string>;
  credentials: {
    email: {
      transport: 'smtp' | 'resend';
      from: string | null;
      host: string | null;
      port: number | null;
      username: string | null;
      api_key: string | null;
      password: string | null;
    };
    oauth: {
      github: { client_id: string | null; client_secret: string | null };
      google: { client_id: string | null; client_secret: string | null };
    };
  };
};

function isEnabled(list: string[], id: ProviderId): boolean {
  return list.includes(id);
}

function setProviderEnabled(list: string[], id: ProviderId, on: boolean): string[] {
  const next = new Set(list);
  if (on) next.add(id);
  else next.delete(id);
  const order: ProviderId[] = ['password', 'email', 'github', 'google'];
  const out = order.filter((p) => next.has(p));
  return out.length > 0 ? out : ['password'];
}

function Field({
  id,
  label,
  hint,
  children,
  className,
}: {
  id: string;
  label: string;
  hint?: string;
  children: ReactNode;
  className?: string;
}) {
  return (
    <div className={cn('space-y-1.5', className)}>
      <Label htmlFor={id} className="text-[13px] font-medium text-foreground/90">
        {label}
      </Label>
      {children}
      {hint ? <p className="text-xs leading-relaxed text-muted-foreground">{hint}</p> : null}
    </div>
  );
}

function CopyableUrl({ label, url }: { label: string; url: string }) {
  const { t } = useI18n();
  const copyMsg = t.platformSettings.access.urlCopied;

  function copy() {
    void navigator.clipboard.writeText(url).then(() => toast.success(copyMsg));
  }

  return (
    <div className="rounded-lg border border-border/70 bg-muted/25 px-3 py-2.5">
      <p className="text-xs font-medium text-muted-foreground">{label}</p>
      <div className="mt-1.5 flex flex-wrap items-start gap-2">
        <code className="min-w-0 flex-1 break-all text-[11px] leading-relaxed text-foreground/90">
          {url}
        </code>
        <Button type="button" variant="outline" size="sm" className="h-7 shrink-0 px-2 text-xs" onClick={copy}>
          {t.common.copy}
        </Button>
      </div>
    </div>
  );
}

function SecretInput({
  id,
  label,
  value,
  onChange,
}: {
  id: string;
  label: string;
  value: string;
  onChange: (value: string) => void;
}) {
  const { t } = useI18n();
  const [visible, setVisible] = useState(false);

  return (
    <Field id={id} label={label}>
      <div className="relative">
        <Input
          id={id}
          type={visible ? 'text' : 'password'}
          autoComplete="off"
          className="h-9 pr-10 font-mono text-sm"
          value={value}
          onChange={(e) => onChange(e.target.value)}
        />
        <Button
          type="button"
          variant="ghost"
          size="icon-sm"
          className="absolute top-1/2 right-1 -translate-y-1/2 text-muted-foreground"
          aria-label={visible ? t.login.hidePassword : t.login.showPassword}
          aria-pressed={visible}
          onClick={() => setVisible((v) => !v)}
        >
          <PublicIcon name={visible ? 'eye-off' : 'eye-open'} size={16} />
        </Button>
      </div>
    </Field>
  );
}

function ProviderBlock({
  title,
  hint,
  enabled,
  onEnabledChange,
  children,
}: {
  title: string;
  hint?: string;
  enabled: boolean;
  onEnabledChange: (on: boolean) => void;
  children?: ReactNode;
}) {
  const { t } = useI18n();
  const copy = t.platformSettings.access;

  return (
    <div className="border-t border-border/80 pt-6 first:border-t-0 first:pt-0">
      <div className="flex items-start justify-between gap-4">
        <div className="min-w-0 space-y-0.5">
          <div className="flex flex-wrap items-center gap-2">
            <h3 className="text-sm font-semibold tracking-tight">{title}</h3>
            {enabled ? (
              <span className="rounded-full bg-primary/10 px-2 py-0.5 text-[10px] font-medium uppercase tracking-wide text-primary">
                {copy.enabledBadge}
              </span>
            ) : null}
          </div>
          {hint ? <p className="text-xs leading-relaxed text-muted-foreground">{hint}</p> : null}
        </div>
        <div className="flex shrink-0 items-center gap-2">
          <Label htmlFor={`enable-${title}`} className="sr-only">
            {copy.enableOnLoginPage}
          </Label>
          <span className="text-xs text-muted-foreground">{copy.enableOnLoginPage}</span>
          <Switch id={`enable-${title}`} checked={enabled} onCheckedChange={onEnabledChange} />
        </div>
      </div>
      {children ? (
        <div
          className={cn(
            'mt-4 space-y-4 rounded-lg border border-border/60 bg-muted/15 p-4 transition-opacity',
            !enabled && 'opacity-60',
          )}
        >
          {children}
        </div>
      ) : null}
    </div>
  );
}

function SignupOption({
  value,
  label,
  description,
}: {
  value: 'open' | 'closed';
  label: string;
  description: string;
}) {
  return (
    <label
      className={cn(
        'flex cursor-pointer gap-3 rounded-lg border px-3 py-3 transition-colors',
        'border-border/70 bg-background hover:bg-muted/30',
        'has-[[data-state=checked]]:border-primary/40 has-[[data-state=checked]]:bg-primary/5 has-[[data-state=checked]]:ring-1 has-[[data-state=checked]]:ring-primary/20',
      )}
    >
      <RadioGroupItem value={value} className="mt-0.5" />
      <span className="min-w-0 space-y-0.5">
        <span className="block text-sm font-medium">{label}</span>
        <span className="block text-xs leading-relaxed text-muted-foreground">{description}</span>
      </span>
    </label>
  );
}

export function PlatformAccessSettings({
  onSiteUrlChange,
}: {
  onSiteUrlChange?: (siteUrl: string) => void;
}) {
  const { t } = useI18n();
  const copy = t.platformSettings.access;
  const apiError = useApiErrorMessage();
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [access, setAccess] = useState<AccessSettings | null>(null);

  const [providers, setProviders] = useState<string[]>(['password']);
  const [signupPolicy, setSignupPolicy] = useState<'open' | 'closed'>('open');
  const [siteUrl, setSiteUrl] = useState('');
  const [magicLinkDevLog, setMagicLinkDevLog] = useState(false);
  const [mailTransport, setMailTransport] = useState<'smtp' | 'resend'>('resend');
  const [emailFrom, setEmailFrom] = useState('');
  const [resendApiKey, setResendApiKey] = useState('');
  const [smtpHost, setSmtpHost] = useState('');
  const [smtpPort, setSmtpPort] = useState('587');
  const [smtpUsername, setSmtpUsername] = useState('');
  const [smtpPassword, setSmtpPassword] = useState('');
  const [githubClientId, setGithubClientId] = useState('');
  const [githubClientSecret, setGithubClientSecret] = useState('');
  const [googleClientId, setGoogleClientId] = useState('');
  const [googleClientSecret, setGoogleClientSecret] = useState('');

  const applyAccess = useCallback((data: AccessSettings) => {
    setAccess(data);
    setProviders(data.auth_providers);
    setSignupPolicy(data.signup_policy);
    const site = normalizeSiteUrl(data.web_origin || data.public_url || '');
    setSiteUrl(site);
    onSiteUrlChange?.(site);
    setMagicLinkDevLog(data.magic_link_dev_log);
    const email = data.credentials.email;
    setMailTransport(email.transport === 'smtp' ? 'smtp' : 'resend');
    setEmailFrom(email.from ?? '');
    setSmtpHost(email.host ?? '');
    setSmtpPort(email.port != null ? String(email.port) : '587');
    setSmtpUsername(email.username ?? '');
    setSmtpPassword(email.password ?? '');
    setResendApiKey(email.api_key ?? '');
    setGithubClientId(data.credentials.oauth.github.client_id ?? '');
    setGithubClientSecret(data.credentials.oauth.github.client_secret ?? '');
    setGoogleClientId(data.credentials.oauth.google.client_id ?? '');
    setGoogleClientSecret(data.credentials.oauth.google.client_secret ?? '');
  }, [onSiteUrlChange]);

  useEffect(() => {
    onSiteUrlChange?.(siteUrl);
  }, [onSiteUrlChange, siteUrl]);

  useEffect(() => {
    let cancelled = false;
    setLoading(true);
    setError(null);
    api<AccessSettings>('/api/settings/access')
      .then((data) => {
        if (!cancelled) applyAccess(data);
      })
      .catch((err) => {
        if (!cancelled) {
          setError(apiError(err));
          setAccess(null);
        }
      })
      .finally(() => {
        if (!cancelled) setLoading(false);
      });
    return () => {
      cancelled = true;
    };
  }, [apiError, applyAccess]);

  async function onSubmit(event: FormEvent) {
    event.preventDefault();
    setSaving(true);
    setError(null);
    const origin = normalizeSiteUrl(siteUrl);
    try {
      const data = await api<AccessSettings>('/api/settings/access', {
        method: 'PUT',
        body: JSON.stringify({
          auth_providers: providers,
          signup_policy: signupPolicy,
          magic_link_dev_log: magicLinkDevLog,
          public_url: origin,
          web_origin: origin,
          credentials: {
            email: {
              transport: mailTransport,
              from: emailFrom.trim() || undefined,
              host: smtpHost.trim() || undefined,
              port: smtpPort.trim() ? Number(smtpPort) : undefined,
              username: smtpUsername.trim() || undefined,
              ...(smtpPassword.trim() ? { password: smtpPassword.trim() } : {}),
              ...(resendApiKey.trim() ? { api_key: resendApiKey.trim() } : {}),
            },
            oauth: {
              github: {
                ...(githubClientId.trim() ? { client_id: githubClientId.trim() } : {}),
                ...(githubClientSecret.trim() ? { client_secret: githubClientSecret.trim() } : {}),
              },
              google: {
                ...(googleClientId.trim() ? { client_id: googleClientId.trim() } : {}),
                ...(googleClientSecret.trim() ? { client_secret: googleClientSecret.trim() } : {}),
              },
            },
          },
        }),
      });
      applyAccess(data);
      toast.success(t.common.save);
    } catch (err) {
      const msg = apiError(err);
      setError(msg);
      toast.error(msg);
    } finally {
      setSaving(false);
    }
  }

  const callbacks = useMemo(
    () => platformAuthCallbacks(siteUrl || access?.public_url || ''),
    [access?.public_url, siteUrl],
  );

  if (loading) {
    return (
      <Card>
        <CardContent className="flex items-center gap-2 py-10 text-sm text-muted-foreground">
          <Spinner className="size-4" />
          {t.common.loading}
        </CardContent>
      </Card>
    );
  }

  if (error && !access) {
    return (
      <Card>
        <CardContent className="py-8 text-sm text-destructive">{error}</CardContent>
      </Card>
    );
  }

  return (
    <form className="space-y-6" onSubmit={(e) => void onSubmit(e)}>
      {error ? (
        <div className="rounded-lg border border-destructive/30 bg-destructive/10 px-3 py-2 text-sm text-destructive">
          {error}
        </div>
      ) : null}

      <Card>
        <CardHeader className="pb-4">
          <CardTitle className="text-base">{copy.formTitle}</CardTitle>
          <CardDescription>{copy.formDesc}</CardDescription>
        </CardHeader>
        <CardContent className="space-y-6">
          <Field id="site-url" label={copy.siteUrl} hint={copy.siteUrlHint}>
            <Input
              id="site-url"
              className="h-9 font-mono text-sm"
              value={siteUrl}
              onChange={(e) => setSiteUrl(e.target.value)}
              placeholder={copy.siteUrlPlaceholder}
            />
          </Field>

          {callbacks ? (
            <div className="space-y-2">
              <Label className="text-[13px] font-medium">{copy.callbacksTitle}</Label>
              <p className="text-xs text-muted-foreground">{copy.callbacksDesc}</p>
              <div className="grid gap-2">
                <CopyableUrl label={copy.callbackGithub} url={callbacks.github} />
                <CopyableUrl label={copy.callbackGoogle} url={callbacks.google} />
                <CopyableUrl label={copy.callbackOrgOidc} url={callbacks.org_oidc} />
              </div>
            </div>
          ) : null}

          <div className="space-y-2">
            <Label className="text-[13px] font-medium">{copy.signupTitle}</Label>
            <p className="text-xs text-muted-foreground">{copy.signupDesc}</p>
            <RadioGroup
              value={signupPolicy}
              onValueChange={(value) => setSignupPolicy(value as 'open' | 'closed')}
              className="grid gap-2 sm:grid-cols-2"
            >
              <SignupOption
                value="open"
                label={copy.signupOpenShort}
                description={copy.signupOpenDetail}
              />
              <SignupOption
                value="closed"
                label={copy.signupClosedShort}
                description={copy.signupClosedDetail}
              />
            </RadioGroup>
          </div>
        </CardContent>
      </Card>

      <Card>
        <CardHeader className="pb-4">
          <CardTitle className="text-base">{copy.providersTitle}</CardTitle>
          <CardDescription>{copy.providersDesc}</CardDescription>
        </CardHeader>
        <CardContent className="space-y-6">
          <ProviderBlock
            title={copy.providerPassword}
            hint={copy.passwordHint}
            enabled={isEnabled(providers, 'password')}
            onEnabledChange={(on) => setProviders((p) => setProviderEnabled(p, 'password', on))}
          />

          <ProviderBlock
            title={copy.providerEmail}
            hint={copy.emailDesc}
            enabled={isEnabled(providers, 'email')}
            onEnabledChange={(on) => setProviders((p) => setProviderEnabled(p, 'email', on))}
          >
            <label className="flex items-center justify-between gap-4 rounded-md border border-border/50 bg-background/80 px-3 py-2 text-sm">
              <span className="text-[13px]">{copy.magicLinkDevLog}</span>
              <Switch checked={magicLinkDevLog} onCheckedChange={setMagicLinkDevLog} />
            </label>
            <Field id="email-from" label={copy.emailFrom}>
              <Input
                id="email-from"
                className="h-9"
                value={emailFrom}
                onChange={(e) => setEmailFrom(e.target.value)}
              />
            </Field>
            <Field id="mail-transport" label={copy.mailTransport}>
              <Select
                value={mailTransport}
                onValueChange={(v) => setMailTransport(v as 'smtp' | 'resend')}
              >
                <SelectTrigger id="mail-transport" className="h-9">
                  <SelectValue />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="resend">{copy.transportResend}</SelectItem>
                  <SelectItem value="smtp">{copy.transportSmtp}</SelectItem>
                </SelectContent>
              </Select>
            </Field>
            {mailTransport === 'resend' ? (
              <SecretInput
                id="resend-key"
                label={copy.resendApiKey}
                value={resendApiKey}
                onChange={setResendApiKey}
              />
            ) : (
              <div className="grid gap-4 sm:grid-cols-2">
                <Field id="smtp-host" label={copy.smtpHost} className="sm:col-span-2">
                  <Input
                    id="smtp-host"
                    className="h-9"
                    value={smtpHost}
                    onChange={(e) => setSmtpHost(e.target.value)}
                  />
                </Field>
                <Field id="smtp-port" label={copy.smtpPort}>
                  <Input
                    id="smtp-port"
                    className="h-9"
                    value={smtpPort}
                    onChange={(e) => setSmtpPort(e.target.value)}
                  />
                </Field>
                <Field id="smtp-user" label={copy.smtpUsername}>
                  <Input
                    id="smtp-user"
                    className="h-9"
                    value={smtpUsername}
                    onChange={(e) => setSmtpUsername(e.target.value)}
                  />
                </Field>
                <div className="sm:col-span-2">
                  <SecretInput
                    id="smtp-pass"
                    label={copy.smtpPassword}
                    value={smtpPassword}
                    onChange={setSmtpPassword}
                  />
                </div>
              </div>
            )}
          </ProviderBlock>

          <ProviderBlock
            title={copy.providerGithub}
            enabled={isEnabled(providers, 'github')}
            onEnabledChange={(on) => setProviders((p) => setProviderEnabled(p, 'github', on))}
          >
            <Field id="gh-id" label={copy.oauthClientId}>
              <Input
                id="gh-id"
                className="h-9 font-mono text-sm"
                value={githubClientId}
                onChange={(e) => setGithubClientId(e.target.value)}
              />
            </Field>
            <SecretInput
              id="gh-secret"
              label={copy.oauthClientSecret}
              value={githubClientSecret}
              onChange={setGithubClientSecret}
            />
          </ProviderBlock>

          <ProviderBlock
            title={copy.providerGoogle}
            enabled={isEnabled(providers, 'google')}
            onEnabledChange={(on) => setProviders((p) => setProviderEnabled(p, 'google', on))}
          >
            <Field id="go-id" label={copy.oauthClientId}>
              <Input
                id="go-id"
                className="h-9 font-mono text-sm"
                value={googleClientId}
                onChange={(e) => setGoogleClientId(e.target.value)}
              />
            </Field>
            <SecretInput
              id="go-secret"
              label={copy.oauthClientSecret}
              value={googleClientSecret}
              onChange={setGoogleClientSecret}
            />
          </ProviderBlock>
        </CardContent>
      </Card>

      <div className="sticky bottom-0 z-10 -mx-1 flex items-center justify-end gap-2 border-t border-border/80 bg-background/95 py-4 backdrop-blur supports-[backdrop-filter]:bg-background/85">
        <Button type="submit" disabled={saving} className="min-w-[7rem]">
          {saving ? (
            <>
              <Spinner className="mr-2 size-4" />
              {t.common.processing}
            </>
          ) : (
            t.common.save
          )}
        </Button>
      </div>
    </form>
  );
}
