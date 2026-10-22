import { Navigate } from 'react-router-dom';
import { Spinner } from '@/components/ui/spinner.js';
import { useI18n } from '@/i18n/context.js';
import { useBasisSession } from '@/lib/session/basis-session.js';
import { basisIsDesktopProduct } from '@/lib/runtime/basis-runtime.js';
import { platformAdminEntryPath } from '@/lib/nav/nav-config.js';
import { useSettingsAccess } from '@/lib/shell/use-settings-access.js';

export function AdminLandingRedirect() {
  const { t } = useI18n();
  const { ready, user, isAdmin, homePath } = useBasisSession();
  const canSettings = useSettingsAccess();

  if (!ready || !user || (!isAdmin && canSettings === null)) {
    return (
      <div className="flex flex-1 items-center justify-center gap-2 text-sm text-muted-foreground">
        <Spinner className="size-4" />
        {t.core.common.loading}
      </div>
    );
  }

  const target = platformAdminEntryPath(
    isAdmin,
    canSettings === true,
    basisIsDesktopProduct(),
  );
  if (target === '/workspaces') {
    return <Navigate to={homePath} replace />;
  }

  return <Navigate to={target} replace />;
}
