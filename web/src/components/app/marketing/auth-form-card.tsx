import { zodResolver } from '@hookform/resolvers/zod';
import { useEffect, useMemo, useState } from 'react';
import { useForm } from 'react-hook-form';
import { useSearchParams } from 'react-router-dom';
import { z } from 'zod';

import { Button } from '@/components/ui/button.js';
import {
  Form,
  FormControl,
  FormField,
  FormItem,
  FormLabel,
} from '@/components/ui/form.js';
import { Input } from '@/components/ui/input.js';
import { PublicIcon } from '@/components/app/shared/primitives/public-icon.js';
import { useI18n } from '@/i18n/context.js';
import type { Locale } from '@/i18n/locale.js';
import { formatUserFacingApiError } from '@/lib/api-error-message.js';
import { api } from '@/lib/api.js';
import { useBasisSession } from '@/lib/basis-session.js';

type AuthMode = 'login' | 'register';

type AuthProviders = {
  password?: boolean;
  github: boolean;
  google: boolean;
  magic_link: boolean;
};

const authFormSchema = z.object({
  email: z.string().email(),
  password: z.string().min(8),
  displayName: z.string().optional(),
});

type AuthFormValues = z.infer<typeof authFormSchema>;

function authSchemaForMode(mode: AuthMode) {
  return authFormSchema.superRefine((data, ctx) => {
    if (mode === 'register' && !data.displayName?.trim()) {
      ctx.addIssue({
        code: z.ZodIssueCode.custom,
        path: ['displayName'],
        message: 'Required',
      });
    }
  });
}

export function AuthFormCard() {
  const { t, locale } = useI18n();
  const { login, register } = useBasisSession();
  const [searchParams, setSearchParams] = useSearchParams();
  const initialMode: AuthMode = searchParams.get('mode') === 'register' ? 'register' : 'login';
  const [mode, setMode] = useState<AuthMode>(initialMode);
  const [showPassword, setShowPassword] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [busy, setBusy] = useState(false);
  const [magicBusy, setMagicBusy] = useState(false);
  const [magicNotice, setMagicNotice] = useState<string | null>(null);
  const [providers, setProviders] = useState<AuthProviders | null>(null);

  const resolver = useMemo(() => zodResolver(authSchemaForMode(mode)), [mode]);

  const form = useForm<AuthFormValues>({
    resolver,
    defaultValues: { email: '', password: '', displayName: '' },
  });

  const email = form.watch('email');

  useEffect(() => {
    setMode(searchParams.get('mode') === 'register' ? 'register' : 'login');
  }, [searchParams]);

  useEffect(() => {
    api<AuthProviders>('/api/auth/providers')
      .then(setProviders)
      .catch(() =>
        setProviders({ github: false, google: false, magic_link: false }),
      );
  }, []);

  function switchMode(next: AuthMode) {
    setMode(next);
    setError(null);
    setShowPassword(false);
    form.clearErrors();
    if (next === 'register') {
      setSearchParams({ mode: 'register' }, { replace: true });
    } else {
      setSearchParams({}, { replace: true });
    }
  }

  async function onMagicLink() {
    setError(null);
    setMagicNotice(null);
    setMagicBusy(true);
    try {
      await api('/api/auth/magic-link/request', {
        method: 'POST',
        body: JSON.stringify({ email }),
      });
      setMagicNotice(t.login.magicLinkSent);
    } catch (err) {
      const message = formatUserFacingApiError(err, locale as Locale);
      setError(message || t.login.magicLinkFailed);
    } finally {
      setMagicBusy(false);
    }
  }

  async function onSubmit(values: AuthFormValues) {
    setError(null);
    setBusy(true);
    try {
      if (mode === 'login') await login(values.email, values.password);
      else await register(values.email, values.password, values.displayName?.trim() ?? '');
    } catch (err) {
      const message = formatUserFacingApiError(err, locale as Locale);
      setError(message || t.login.loginFailed);
    } finally {
      setBusy(false);
    }
  }

  const isRegister = mode === 'register';
  const showMagicLink = !isRegister && providers?.magic_link === true;
  const showGithub = !isRegister && providers?.github === true;
  const showGoogle = !isRegister && providers?.google === true;
  const showOAuth = showGithub || showGoogle;

  const fieldLabel = 'text-[13px] font-medium text-foreground/75';
  const fieldInput =
    'h-10 border-foreground/12 bg-[#f4f5f7] shadow-none dark:border-white/12 dark:bg-[#0c1016]';

  return (
    <div className="flex min-h-0 flex-col">
      <div className="pt-5 pr-12 pb-0 pl-6">
        <h2 className="text-xl font-semibold tracking-[-0.03em] text-foreground">
          {isRegister ? t.login.registerTitle : t.login.title}
        </h2>
        <p className="mt-1.5 text-sm leading-snug text-muted-foreground">
          {isRegister ? t.login.registerSubtitle : t.login.subtitle}
        </p>
      </div>

      <Form {...form}>
        <form className="mt-4 flex min-h-0 flex-col" onSubmit={form.handleSubmit(onSubmit)}>
          <div className="min-h-0 space-y-3 overflow-y-auto px-6">
            {isRegister && (
              <FormField
                control={form.control}
                name="displayName"
                render={({ field }) => (
                  <FormItem className="space-y-1.5">
                    <FormLabel className={fieldLabel}>{t.login.displayNameLabel}</FormLabel>
                    <FormControl>
                      <Input
                        autoComplete="name"
                        placeholder={t.login.displayNamePlaceholder}
                        className={fieldInput}
                        {...field}
                      />
                    </FormControl>
                  </FormItem>
                )}
              />
            )}
            <FormField
              control={form.control}
              name="email"
              render={({ field }) => (
                <FormItem className="space-y-1.5">
                  <FormLabel className={fieldLabel}>{t.login.emailLabel}</FormLabel>
                  <FormControl>
                    <Input
                      type="email"
                      autoComplete="email"
                      placeholder={t.login.emailPlaceholder}
                      className={fieldInput}
                      {...field}
                    />
                  </FormControl>
                </FormItem>
              )}
            />
            <FormField
              control={form.control}
              name="password"
              render={({ field }) => (
                <FormItem className="space-y-1.5">
                  <FormLabel className={fieldLabel}>{t.login.passwordLabel}</FormLabel>
                  <FormControl>
                    <div className="relative">
                      <Input
                        type={showPassword ? 'text' : 'password'}
                        autoComplete={isRegister ? 'new-password' : 'current-password'}
                        placeholder={t.login.passwordPlaceholder}
                        className={`${fieldInput} pr-10`}
                        {...field}
                      />
                      <Button
                        type="button"
                        variant="ghost"
                        size="icon-sm"
                        className="absolute top-1/2 right-1 -translate-y-1/2 text-muted-foreground"
                        aria-label={showPassword ? t.login.hidePassword : t.login.showPassword}
                        aria-pressed={showPassword}
                        onClick={() => setShowPassword((visible) => !visible)}
                      >
                        <PublicIcon name={showPassword ? 'eye-off' : 'eye-open'} size={16} />
                      </Button>
                    </div>
                  </FormControl>
                </FormItem>
              )}
            />
            {error && (
              <p role="alert" className="rounded-md bg-destructive/10 px-3 py-2 text-sm leading-relaxed text-destructive">
                {error}
              </p>
            )}
          </div>
          <div className="px-6 pt-3 space-y-2">
            <Button
              type="submit"
              size="lg"
              disabled={busy}
              className="w-full bg-[#152033] text-[#f6f4ef] hover:bg-[#152033] hover:brightness-110 dark:bg-[#f3ead7] dark:text-[#152033] dark:hover:bg-[#f3ead7]"
            >
              {busy ? t.login.submitting : isRegister ? t.login.registerSubmit : t.login.submit}
            </Button>
            {showMagicLink ? (
              <Button
                type="button"
                variant="outline"
                size="lg"
                className="w-full"
                disabled={magicBusy || !email.trim()}
                onClick={() => void onMagicLink()}
              >
                {magicBusy ? t.login.submitting : t.login.magicLinkSend}
              </Button>
            ) : null}
            {magicNotice ? (
              <p className="text-xs text-muted-foreground">{magicNotice}</p>
            ) : null}
          </div>
        </form>
      </Form>

      {showOAuth ? (
        <div className="mx-6 mt-1 space-y-2 pb-2">
          <p className="text-center text-xs text-muted-foreground">{t.login.orContinueWith}</p>
          <div
            className={
              showGithub && showGoogle ? 'grid grid-cols-2 gap-2' : 'grid grid-cols-1 gap-2'
            }
          >
            {showGithub ? (
              <Button type="button" variant="outline" size="sm" asChild>
                <a href="/api/auth/oauth/github/start">{t.login.continueGithub}</a>
              </Button>
            ) : null}
            {showGoogle ? (
              <Button type="button" variant="outline" size="sm" asChild>
                <a href="/api/auth/oauth/google/start">{t.login.continueGoogle}</a>
              </Button>
            ) : null}
          </div>
        </div>
      ) : null}

      <p className="mx-6 mt-3 mb-4 border-t border-foreground/10 pt-3.5 text-sm text-muted-foreground">
        {isRegister ? t.login.hasAccount : t.login.noAccount}{' '}
        <Button
          type="button"
          variant="link"
          className="h-auto p-0 font-medium text-foreground"
          onClick={() => switchMode(isRegister ? 'login' : 'register')}
        >
          {isRegister ? t.login.switchToLogin : t.login.switchToRegister}
        </Button>
      </p>
    </div>
  );
}
