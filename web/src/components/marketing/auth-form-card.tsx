import { type FormEvent, useEffect, useState } from 'react';
import { useSearchParams } from 'react-router-dom';

import { Button } from '@/components/ui/button.js';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card.js';
import { Input } from '@/components/ui/input.js';
import { Label } from '@/components/ui/label.js';
import { useI18n } from '@/i18n/context.js';
import { formatUserFacingApiError } from '@/lib/api-error-message.js';
import { useBasisSession } from '@/lib/basis-session.js';

type AuthMode = 'login' | 'register';

export function AuthFormCard() {
  const { t, locale } = useI18n();
  const { login, register } = useBasisSession();
  const [searchParams, setSearchParams] = useSearchParams();
  const initialMode: AuthMode = searchParams.get('mode') === 'register' ? 'register' : 'login';
  const [mode, setMode] = useState<AuthMode>(initialMode);
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [displayName, setDisplayName] = useState('');
  const [error, setError] = useState<string | null>(null);
  const [busy, setBusy] = useState(false);

  useEffect(() => {
    setMode(searchParams.get('mode') === 'register' ? 'register' : 'login');
  }, [searchParams]);

  function switchMode(next: AuthMode) {
    setMode(next);
    setError(null);
    if (next === 'register') {
      setSearchParams({ mode: 'register' }, { replace: true });
    } else {
      setSearchParams({}, { replace: true });
    }
  }

  async function onSubmit(event: FormEvent) {
    event.preventDefault();
    setError(null);
    setBusy(true);
    try {
      if (mode === 'login') await login(email, password);
      else await register(email, password, displayName);
    } catch (err) {
      const message = formatUserFacingApiError(err, locale === 'zh' ? 'zh' : 'en');
      setError(message || t.login.loginFailed);
    } finally {
      setBusy(false);
    }
  }

  const isRegister = mode === 'register';

  return (
    <Card className="w-full border-border/80 bg-card/95 shadow-lg backdrop-blur-sm">
      <CardHeader className="pb-4">
        <CardTitle className="text-lg">
          {isRegister ? t.login.registerTitle : t.login.title}
        </CardTitle>
      </CardHeader>
      <CardContent>
        <form className="space-y-3" onSubmit={onSubmit}>
          {isRegister && (
            <div className="space-y-1.5">
              <Label htmlFor="display_name">{t.login.displayNameLabel}</Label>
              <Input
                id="display_name"
                value={displayName}
                onChange={(e) => setDisplayName(e.target.value)}
                placeholder={t.login.displayNamePlaceholder}
                required
              />
            </div>
          )}
          <div className="space-y-1.5">
            <Label htmlFor="email">{t.login.emailLabel}</Label>
            <Input
              id="email"
              type="email"
              autoComplete="email"
              value={email}
              onChange={(e) => setEmail(e.target.value)}
              placeholder={t.login.emailPlaceholder}
              required
            />
          </div>
          <div className="space-y-1.5">
            <Label htmlFor="password">{t.login.passwordLabel}</Label>
            <Input
              id="password"
              type="password"
              autoComplete={isRegister ? 'new-password' : 'current-password'}
              minLength={8}
              value={password}
              onChange={(e) => setPassword(e.target.value)}
              placeholder={t.login.passwordPlaceholder}
              required
            />
          </div>
          {error && <p className="text-sm text-destructive">{error}</p>}
          <Button type="submit" disabled={busy} className="mt-1 w-full rounded-xl">
            {busy
              ? t.login.submitting
              : isRegister
                ? t.login.registerSubmit
                : t.login.submit}
          </Button>
        </form>
        <p className="mt-3 text-center text-sm text-muted-foreground">
          {isRegister ? (
            <button
              type="button"
              className="underline-offset-4 hover:text-foreground hover:underline"
              onClick={() => switchMode('login')}
            >
              {t.login.switchToLogin}
            </button>
          ) : (
            <button
              type="button"
              className="underline-offset-4 hover:text-foreground hover:underline"
              onClick={() => switchMode('register')}
            >
              {t.login.switchToRegister}
            </button>
          )}
        </p>
      </CardContent>
    </Card>
  );
}
