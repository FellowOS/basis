import { Navigate, Outlet } from 'react-router-dom';
import { Spinner } from '@/components/ui/spinner.js';
import { useI18n } from '@/i18n/context.js';
import { useBasisSession } from '@/lib/basis-session.js';
import { visiblePlatformNavItems } from '@/lib/nav-config.js';
import { useSettingsAccess } from '@/lib/use-settings-access.js';

export function PlatformAdminLayout() {
  const { t } = useI18n();
  const { isAdmin, homePath } = useBasisSession();
  const canSettings = useSettingsAccess();
  const settingsReady = isAdmin || canSettings !== null;
  const items = visiblePlatformNavItems(isAdmin, canSettings === true);

  if (!settingsReady) {
    return (
      <div className="flex flex-1 items-center justify-center gap-2 text-sm text-muted-foreground">
        <Spinner className="size-4" />
        {t.common.loading}
      </div>
    );
  }

  if (items.length === 0) {
    return <Navigate to={homePath} replace />;
  }

  return (
    <div className="flex min-h-0 flex-1 flex-col">
      <Outlet />
    </div>
  );
}
