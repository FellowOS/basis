import { useMemo } from 'react';
import type { Crumb } from '@/components/app/shared/console/PageHeader.js';
import { useI18n } from '@/i18n/context.js';
import { useBasisSession } from '@/lib/basis-session.js';
import { basisIsDesktopProduct } from '@/lib/basis-runtime.js';
import { platformAdminEntryPath } from '@/lib/nav-config.js';
import { useSettingsAccess } from '@/lib/use-settings-access.js';

/** Breadcrumb trail for `/admin/*` console pages: Administration → section. */
export function usePlatformAdminCrumbs(sectionLabel: string): Crumb[] {
  const { t } = useI18n();
  const { isAdmin } = useBasisSession();
  const canSettings = useSettingsAccess();

  return useMemo(
    () => [
      {
        label: t.sidebar.management,
        to: platformAdminEntryPath(isAdmin, canSettings === true, basisIsDesktopProduct()),
      },
      { label: sectionLabel },
    ],
    [canSettings, isAdmin, sectionLabel, t.sidebar.management],
  );
}
