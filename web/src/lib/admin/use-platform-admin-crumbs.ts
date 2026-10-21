import { useMemo } from 'react';
import type { Crumb } from '@/components/app/shared/console/PageHeader.js';
import { useI18n } from '@/i18n/context.js';
import { useBasisSession } from '@/lib/session/basis-session.js';
import { basisIsDesktopProduct } from '@/lib/runtime/basis-runtime.js';
import { platformAdminEntryPath } from '@/lib/nav/nav-config.js';
import { useSettingsAccess } from '@/lib/shell/use-settings-access.js';

/** Breadcrumb trail for `/admin/*` console pages: Administration → section. */
export function usePlatformAdminCrumbs(sectionLabel: string): Crumb[] {
  const { t } = useI18n();
  const { isAdmin } = useBasisSession();
  const canSettings = useSettingsAccess();

  return useMemo(
    () => [
      {
        label: t.core.shell.sidebar.management,
        to: platformAdminEntryPath(isAdmin, canSettings === true, basisIsDesktopProduct()),
      },
      { label: sectionLabel },
    ],
    [canSettings, isAdmin, sectionLabel, t.core.shell.sidebar.management],
  );
}
