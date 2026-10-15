import { Navigate } from 'react-router-dom';

import { Hero1 } from '@/components/blocks/hero-1.js';
import { AuthFormCard } from '@/components/marketing/auth-form-card.js';
import { MarketingHeader } from '@/components/marketing/marketing-header.js';
import { useI18n } from '@/i18n/context.js';
import { useBasisSession } from '@/lib/basis-session.js';

export function HomePage() {
  const { t } = useI18n();
  const { ready, user, homePath } = useBasisSession();
  const m = t.marketing;

  if (ready && user) return <Navigate to={homePath} replace />;

  const year = new Date().getFullYear();

  return (
    <div
      className="login-marketing-shell relative flex h-dvh max-h-dvh flex-col overflow-hidden overscroll-none text-foreground"
    >
      <MarketingHeader showAuthActions={false} />

      <main className="relative z-10 flex min-h-0 flex-1 flex-col">
        <Hero1
          pillText={m.heroEyebrow}
          headline={m.heroHeadline}
          subhead={m.heroSubhead}
          highlights={m.highlights}
          aside={<AuthFormCard />}
          footerCopyright={m.footerCopyright.replace('{year}', String(year))}
          footerTagline={m.footerTagline}
        />
      </main>
    </div>
  );
}
