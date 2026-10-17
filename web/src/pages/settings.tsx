import type { ReactNode } from 'react';
import { useState } from 'react';
import { PlatformAccessSettings } from '@/components/platform/platform-access-settings.js';
import { PlatformOrgSsoSection } from '@/components/platform/platform-org-sso-section.js';
import { ConsolePageLayout } from '@/components/console-ui/index.js';
import { useI18n } from '@/i18n/context.js';
import { useBasisSession } from '@/lib/basis-session.js';

function SettingsSection({
  title,
  description,
  children,
}: {
  title: string;
  description?: string;
  children: ReactNode;
}) {
  return (
    <section className="space-y-4">
      <header className="space-y-1">
        <h2 className="text-lg font-semibold tracking-tight">{title}</h2>
        {description ? (
          <p className="max-w-2xl text-sm leading-relaxed text-muted-foreground">{description}</p>
        ) : null}
      </header>
      {children}
    </section>
  );
}

export function SettingsPage() {
  const { t } = useI18n();
  const ps = t.platformSettings;
  const { isAdmin } = useBasisSession();
  const [siteUrl, setSiteUrl] = useState('');

  return (
    <ConsolePageLayout crumbs={[{ label: t.menu.system.title }]} subtitle={t.menu.system.hint}>
      <div className="mx-auto w-full max-w-3xl space-y-12 pb-4">
        {isAdmin ? (
          <SettingsSection title={ps.tabAccess} description={ps.access.pageLead}>
            <PlatformAccessSettings onSiteUrlChange={setSiteUrl} />
          </SettingsSection>
        ) : null}

        <SettingsSection title={ps.tabOrgSso} description={ps.orgSsoSectionLead}>
          <PlatformOrgSsoSection siteBaseUrl={siteUrl} />
        </SettingsSection>
      </div>
    </ConsolePageLayout>
  );
}
