import { type FormEvent, useEffect, useState } from 'react';
import { Link, Navigate, useSearchParams } from 'react-router-dom';
import { HeroBackground } from '@/components/marketing/hero-background.js';
import { MarketingHeader } from '@/components/marketing/marketing-header.js';
import { Button } from '@/components/ui/button.js';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card.js';
import { Input } from '@/components/ui/input.js';
import { Label } from '@/components/ui/label.js';
import { useI18n } from '@/i18n/context.js';
import { useSemaSession } from '@/lib/sema-session.js';

export function LoginPage() {
  const { t } = useI18n();
  const { ready, user, homePath, login, register } = useSemaSession();
  const [searchParams] = useSearchParams();
  const initialMode = searchParams.get('mode') === 'register' ? 'register' : 'login';
  const [mode, setMode] = useState<'login' | 'register'>(initialMode);
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [displayName, setDisplayName] = useState('');
  const [error, setError] = useState<string | null>(null);
  const [busy, setBusy] = useState(false);

  useEffect(() => {
    setMode(searchParams.get('mode') === 'register' ? 'register' : 'login');
  }, [searchParams]);

  if (ready && user) return <Navigate to={homePath} replace />;

  async function onSubmit(event: FormEvent) {
    event.preventDefault();
    setError(null);
    setBusy(true);
    try {
      if (mode === 'login') await login(email, password);
      else await register(email, password, displayName);
    } catch (err) {
      setError(err instanceof Error ? err.message : t.login.loginFailed);
    } finally {
      setBusy(false);
    }
  }

  const isRegister = mode === 'register';

  return (
    <div className="login-marketing-shell relative flex min-h-dvh flex-col text-foreground">
      <HeroBackground />
      <MarketingHeader />

      <div className="relative z-10 flex flex-1 flex-col items-center justify-center px-4 pb-8 pt-20">
        <Card className="w-full max-w-md border-border/80 bg-card/95 shadow-lg backdrop-blur-sm">
          <CardHeader>
            <CardTitle>{isRegister ? t.login.registerTitle : t.login.title}</CardTitle>
            <CardDescription>
              {isRegister ? t.login.registerSubtitle : t.login.subtitle}
            </CardDescription>
          </CardHeader>
          <CardContent>
            <form className="space-y-4" onSubmit={onSubmit}>
              {isRegister && (
                <div className="space-y-2">
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
              <div className="space-y-2">
                <Label htmlFor="email">{t.login.emailLabel}</Label>
                <Input
                  id="email"
                  type="email"
                  value={email}
                  onChange={(e) => setEmail(e.target.value)}
                  placeholder={t.login.emailPlaceholder}
                  required
                />
              </div>
              <div className="space-y-2">
                <Label htmlFor="password">{t.login.passwordLabel}</Label>
                <Input
                  id="password"
                  type="password"
                  minLength={8}
                  value={password}
                  onChange={(e) => setPassword(e.target.value)}
                  placeholder={t.login.passwordPlaceholder}
                  required
                />
              </div>
              {error && <p className="text-sm text-destructive">{error}</p>}
              <div className="flex flex-wrap gap-2 pt-2">
                <Button type="submit" disabled={busy} className="rounded-xl">
                  {busy
                    ? t.login.submitting
                    : isRegister
                      ? t.login.registerSubmit
                      : t.login.submit}
                </Button>
                <Button
                  type="button"
                  variant="outline"
                  className="rounded-xl"
                  onClick={() => setMode(isRegister ? 'login' : 'register')}
                >
                  {isRegister ? t.login.switchToLogin : t.login.switchToRegister}
                </Button>
              </div>
            </form>
            <p className="mt-4 text-center text-sm">
              <Link to="/" className="text-muted-foreground underline-offset-4 hover:text-foreground hover:underline">
                {t.login.backHome}
              </Link>
            </p>
          </CardContent>
        </Card>
      </div>
    </div>
  );
}
