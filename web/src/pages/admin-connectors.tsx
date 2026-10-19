import { PlatformConnectorAdmin } from '@/components/admin/platform-connector-admin.js';
import { ConsolePageLayout } from '@/components/app/shared/console/index.js';
import { useI18n } from '@/i18n/context.js';
import { usePlatformAdminCrumbs } from '@/lib/use-platform-admin-crumbs.js';

export function AdminConnectorsPage() {
  const { t } = useI18n();
  const ps = t.platformSettings.connectors;
  const crumbs = usePlatformAdminCrumbs(t.menu.platform.connectors);

  return (
    <ConsolePageLayout
      crumbs={crumbs}
      subtitle={ps.sectionLead}
    >
      <PlatformConnectorAdmin />
    </ConsolePageLayout>
  );
}
